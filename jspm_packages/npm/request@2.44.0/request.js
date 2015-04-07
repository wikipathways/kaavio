/* */ 
(function(Buffer, process) {
  var optional = require("./lib/optional"),
      http = require("http"),
      https = optional('https'),
      tls = optional('tls'),
      url = require("url"),
      util = require("util"),
      stream = require("stream"),
      qs = require("qs"),
      querystring = require("querystring"),
      crypto = require("crypto"),
      zlib = require("zlib"),
      bl = require("bl"),
      oauth = optional('oauth-sign'),
      hawk = optional('hawk'),
      aws = optional('aws-sign2'),
      httpSignature = optional('http-signature'),
      uuid = require("node-uuid"),
      mime = require("mime-types"),
      tunnel = require("tunnel-agent"),
      _safeStringify = require("json-stringify-safe"),
      stringstream = optional('stringstream'),
      caseless = require("caseless"),
      ForeverAgent = require("forever-agent"),
      FormData = optional('form-data'),
      cookies = require("./lib/cookies"),
      globalCookieJar = cookies.jar(),
      copy = require("./lib/copy"),
      debug = require("./lib/debug"),
      net = require("net");
  ;
  function safeStringify(obj) {
    var ret;
    try {
      ret = JSON.stringify(obj);
    } catch (e) {
      ret = _safeStringify(obj);
    }
    return ret;
  }
  var globalPool = {};
  var isUrl = /^https?:|^unix:/;
  var defaultProxyHeaderWhiteList = ['accept', 'accept-charset', 'accept-encoding', 'accept-language', 'accept-ranges', 'cache-control', 'content-encoding', 'content-language', 'content-length', 'content-location', 'content-md5', 'content-range', 'content-type', 'connection', 'date', 'expect', 'max-forwards', 'pragma', 'proxy-authorization', 'referer', 'te', 'transfer-encoding', 'user-agent', 'via'];
  function isReadStream(rs) {
    return rs.readable && rs.path && rs.mode;
  }
  function toBase64(str) {
    return (new Buffer(str || "", "ascii")).toString("base64");
  }
  function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }
  function requestToJSON() {
    return {
      uri: this.uri,
      method: this.method,
      headers: this.headers
    };
  }
  function responseToJSON() {
    return {
      statusCode: this.statusCode,
      body: this.body,
      headers: this.headers,
      request: requestToJSON.call(this.request)
    };
  }
  function Request(options) {
    stream.Stream.call(this);
    this.readable = true;
    this.writable = true;
    if (typeof options === 'string') {
      options = {uri: options};
    }
    var reserved = Object.keys(Request.prototype);
    for (var i in options) {
      if (reserved.indexOf(i) === -1) {
        this[i] = options[i];
      } else {
        if (typeof options[i] === 'function') {
          delete options[i];
        }
      }
    }
    if (options.method) {
      this.explicitMethod = true;
    }
    if (typeof options.tunnel === 'undefined')
      options.tunnel = false;
    this.init(options);
  }
  util.inherits(Request, stream.Stream);
  Request.prototype.setupTunnel = function() {
    var self = this;
    if (typeof self.proxy == 'string')
      self.proxy = url.parse(self.proxy);
    if (!self.proxy)
      return false;
    if (!self.tunnel && self.uri.protocol !== 'https:')
      return ;
    var proxyHost = self.uri.hostname + ':';
    if (self.uri.port)
      proxyHost += self.uri.port;
    else if (self.uri.protocol === 'https:')
      proxyHost += '443';
    else
      proxyHost += '80';
    if (!self.proxyHeaderWhiteList)
      self.proxyHeaderWhiteList = defaultProxyHeaderWhiteList;
    var proxyHeaders = Object.keys(self.headers).filter(function(h) {
      return self.proxyHeaderWhiteList.indexOf(h.toLowerCase()) !== -1;
    }).reduce(function(set, h) {
      set[h] = self.headers[h];
      return set;
    }, {});
    proxyHeaders.host = proxyHost;
    var tunnelFnName = (self.uri.protocol === 'https:' ? 'https' : 'http') + 'Over' + (self.proxy.protocol === 'https:' ? 'Https' : 'Http');
    var tunnelFn = tunnel[tunnelFnName];
    var proxyAuth;
    if (self.proxy.auth)
      proxyAuth = self.proxy.auth;
    else if (self.proxyAuthorization)
      proxyHeaders['Proxy-Authorization'] = self.proxyAuthorization;
    var tunnelOptions = {
      proxy: {
        host: self.proxy.hostname,
        port: +self.proxy.port,
        proxyAuth: proxyAuth,
        headers: proxyHeaders
      },
      rejectUnauthorized: self.rejectUnauthorized,
      headers: self.headers,
      ca: self.ca,
      cert: self.cert,
      key: self.key
    };
    self.agent = tunnelFn(tunnelOptions);
    self.tunnel = true;
    return true;
  };
  Request.prototype.init = function(options) {
    var self = this;
    if (!options)
      options = {};
    self.headers = self.headers ? copy(self.headers) : {};
    caseless.httpify(self, self.headers);
    if (self.hasHeader('proxy-authorization')) {
      self.proxyAuthorization = self.getHeader('proxy-authorization');
      self.removeHeader('proxy-authorization');
    }
    if (!self.method)
      self.method = options.method || 'GET';
    self.localAddress = options.localAddress;
    debug(options);
    if (!self.pool && self.pool !== false)
      self.pool = globalPool;
    self.dests = self.dests || [];
    self.__isRequestRequest = true;
    if (!self._callback && self.callback) {
      self._callback = self.callback;
      self.callback = function() {
        if (self._callbackCalled)
          return ;
        self._callbackCalled = true;
        self._callback.apply(self, arguments);
      };
      self.on('error', self.callback.bind());
      self.on('complete', self.callback.bind(self, null));
    }
    if (self.url && !self.uri) {
      self.uri = self.url;
      delete self.url;
    }
    if (!self.uri) {
      return self.emit('error', new Error("options.uri is a required argument"));
    } else {
      if (typeof self.uri == "string")
        self.uri = url.parse(self.uri);
    }
    if (self.strictSSL === false) {
      self.rejectUnauthorized = false;
    }
    if (!self.hasOwnProperty('proxy')) {
      if (self.uri.protocol == "http:") {
        self.proxy = process.env.HTTP_PROXY || process.env.http_proxy || null;
      } else if (self.uri.protocol == "https:") {
        self.proxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
      }
    }
    self.tunnel = !!options.tunnel;
    if (self.proxy) {
      self.setupTunnel();
    }
    if (!self.uri.pathname) {
      self.uri.pathname = '/';
    }
    if (!self.uri.host && !self.protocol == 'unix:') {
      var faultyUri = url.format(self.uri);
      var message = 'Invalid URI "' + faultyUri + '"';
      if (Object.keys(options).length === 0) {
        message += '. This can be caused by a crappy redirection.';
      }
      self.emit('error', new Error(message));
      return ;
    }
    self._redirectsFollowed = self._redirectsFollowed || 0;
    self.maxRedirects = (self.maxRedirects !== undefined) ? self.maxRedirects : 10;
    self.allowRedirect = (typeof self.followRedirect === 'function') ? self.followRedirect : function(response) {
      return true;
    };
    self.followRedirect = (self.followRedirect !== undefined) ? !!self.followRedirect : true;
    self.followAllRedirects = (self.followAllRedirects !== undefined) ? self.followAllRedirects : false;
    if (self.followRedirect || self.followAllRedirects)
      self.redirects = self.redirects || [];
    self.setHost = false;
    if (!self.hasHeader('host')) {
      self.setHeader('host', self.uri.hostname);
      if (self.uri.port) {
        if (!(self.uri.port === 80 && self.uri.protocol === 'http:') && !(self.uri.port === 443 && self.uri.protocol === 'https:'))
          self.setHeader('host', self.getHeader('host') + (':' + self.uri.port));
      }
      self.setHost = true;
    }
    self.jar(self._jar || options.jar);
    if (!self.uri.port) {
      if (self.uri.protocol == 'http:') {
        self.uri.port = 80;
      } else if (self.uri.protocol == 'https:') {
        self.uri.port = 443;
      }
    }
    if (self.proxy && !self.tunnel) {
      self.port = self.proxy.port;
      self.host = self.proxy.hostname;
    } else {
      self.port = self.uri.port;
      self.host = self.uri.hostname;
    }
    self.clientErrorHandler = function(error) {
      if (self._aborted)
        return ;
      if (self.req && self.req._reusedSocket && error.code === 'ECONNRESET' && self.agent.addRequestNoreuse) {
        self.agent = {addRequest: self.agent.addRequestNoreuse.bind(self.agent)};
        self.start();
        self.req.end();
        return ;
      }
      if (self.timeout && self.timeoutTimer) {
        clearTimeout(self.timeoutTimer);
        self.timeoutTimer = null;
      }
      self.emit('error', error);
    };
    self._parserErrorHandler = function(error) {
      if (this.res) {
        if (this.res.request) {
          this.res.request.emit('error', error);
        } else {
          this.res.emit('error', error);
        }
      } else {
        this._httpMessage.emit('error', error);
      }
    };
    self._buildRequest = function() {
      var self = this;
      if (options.form) {
        self.form(options.form);
      }
      if (options.qs)
        self.qs(options.qs);
      if (self.uri.path) {
        self.path = self.uri.path;
      } else {
        self.path = self.uri.pathname + (self.uri.search || "");
      }
      if (self.path.length === 0)
        self.path = '/';
      if (options.oauth) {
        self.oauth(options.oauth);
      }
      if (options.aws) {
        self.aws(options.aws);
      }
      if (options.hawk) {
        self.hawk(options.hawk);
      }
      if (options.httpSignature) {
        self.httpSignature(options.httpSignature);
      }
      if (options.auth) {
        if (Object.prototype.hasOwnProperty.call(options.auth, 'username'))
          options.auth.user = options.auth.username;
        if (Object.prototype.hasOwnProperty.call(options.auth, 'password'))
          options.auth.pass = options.auth.password;
        self.auth(options.auth.user, options.auth.pass, options.auth.sendImmediately, options.auth.bearer);
      }
      if (self.gzip && !self.hasHeader('accept-encoding')) {
        self.setHeader('accept-encoding', 'gzip');
      }
      if (self.uri.auth && !self.hasHeader('authorization')) {
        var authPieces = self.uri.auth.split(':').map(function(item) {
          return querystring.unescape(item);
        });
        self.auth(authPieces[0], authPieces.slice(1).join(':'), true);
      }
      if (self.proxy && !self.tunnel) {
        if (self.proxy.auth && !self.proxyAuthorization) {
          var authPieces = self.proxy.auth.split(':').map(function(item) {
            return querystring.unescape(item);
          });
          var authHeader = 'Basic ' + toBase64(authPieces.join(':'));
          self.proxyAuthorization = authHeader;
        }
        if (self.proxyAuthorization)
          self.setHeader('proxy-authorization', self.proxyAuthorization);
      }
      if (self.proxy && !self.tunnel)
        self.path = (self.uri.protocol + '//' + self.uri.host + self.path);
      if (options.json) {
        self.json(options.json);
      } else if (options.multipart) {
        self.boundary = uuid();
        self.multipart(options.multipart);
      }
      if (self.body) {
        var length = 0;
        if (!Buffer.isBuffer(self.body)) {
          if (Array.isArray(self.body)) {
            for (var i = 0; i < self.body.length; i++) {
              length += self.body[i].length;
            }
          } else {
            self.body = new Buffer(self.body);
            length = self.body.length;
          }
        } else {
          length = self.body.length;
        }
        if (length) {
          if (!self.hasHeader('content-length'))
            self.setHeader('content-length', length);
        } else {
          throw new Error('Argument error, options.body.');
        }
      }
      var protocol = self.proxy && !self.tunnel ? self.proxy.protocol : self.uri.protocol,
          defaultModules = {
            'http:': http,
            'https:': https,
            'unix:': http
          },
          httpModules = self.httpModules || {};
      ;
      self.httpModule = httpModules[protocol] || defaultModules[protocol];
      if (!self.httpModule)
        return this.emit('error', new Error("Invalid protocol: " + protocol));
      if (options.ca)
        self.ca = options.ca;
      if (!self.agent) {
        if (options.agentOptions)
          self.agentOptions = options.agentOptions;
        if (options.agentClass) {
          self.agentClass = options.agentClass;
        } else if (options.forever) {
          self.agentClass = protocol === 'http:' ? ForeverAgent : ForeverAgent.SSL;
        } else {
          self.agentClass = self.httpModule.Agent;
        }
      }
      if (self.pool === false) {
        self.agent = false;
      } else {
        self.agent = self.agent || self.getAgent();
        if (self.maxSockets) {
          self.agent.maxSockets = self.maxSockets;
        }
        if (self.pool.maxSockets) {
          self.agent.maxSockets = self.pool.maxSockets;
        }
      }
      self.on('pipe', function(src) {
        if (self.ntick && self._started)
          throw new Error("You cannot pipe to this stream after the outbound request has started.");
        self.src = src;
        if (isReadStream(src)) {
          if (!self.hasHeader('content-type'))
            self.setHeader('content-type', mime.lookup(src.path));
        } else {
          if (src.headers) {
            for (var i in src.headers) {
              if (!self.hasHeader(i)) {
                self.setHeader(i, src.headers[i]);
              }
            }
          }
          if (self._json && !self.hasHeader('content-type'))
            self.setHeader('content-type', 'application/json');
          if (src.method && !self.explicitMethod) {
            self.method = src.method;
          }
        }
      });
      process.nextTick(function() {
        if (self._aborted)
          return ;
        var end = function() {
          if (self._form) {
            self._form.pipe(self);
          }
          if (self.body) {
            if (Array.isArray(self.body)) {
              self.body.forEach(function(part) {
                self.write(part);
              });
            } else {
              self.write(self.body);
            }
            self.end();
          } else if (self.requestBodyStream) {
            console.warn("options.requestBodyStream is deprecated, please pass the request object to stream.pipe.");
            self.requestBodyStream.pipe(self);
          } else if (!self.src) {
            if (self.method !== 'GET' && typeof self.method !== 'undefined') {
              self.setHeader('content-length', 0);
            }
            self.end();
          }
        };
        if (self._form && !self.hasHeader('content-length')) {
          self.setHeader(self._form.getHeaders());
          self._form.getLength(function(err, length) {
            if (!err) {
              self.setHeader('content-length', length);
            }
            end();
          });
        } else {
          end();
        }
        self.ntick = true;
      });
    };
    self._handleUnixSocketURI = function(self) {
      self.unixsocket = true;
      var full_path = self.uri.href.replace(self.uri.protocol + '/', '');
      var lookup = full_path.split('/');
      var error_connecting = true;
      var lookup_table = {};
      do {
        lookup_table[lookup.join('/')] = {};
      } while (lookup.pop());
      for (r in lookup_table) {
        try_next(r);
      }
      function try_next(table_row) {
        var client = net.connect(table_row);
        client.path = table_row;
        client.on('error', function() {
          lookup_table[this.path].error_connecting = true;
          this.end();
        });
        client.on('connect', function() {
          lookup_table[this.path].error_connecting = false;
          this.end();
        });
        table_row.client = client;
      }
      wait_for_socket_response();
      response_counter = 0;
      function wait_for_socket_response() {
        var detach;
        if ('undefined' == typeof setImmediate)
          detach = process.nextTick;
        else
          detach = setImmediate;
        detach(function() {
          response_counter++;
          var trying = false;
          for (r in lookup_table) {
            if ('undefined' == typeof lookup_table[r].error_connecting)
              trying = true;
          }
          if (trying && response_counter < 1000)
            wait_for_socket_response();
          else
            set_socket_properties();
        });
      }
      function set_socket_properties() {
        var host;
        for (r in lookup_table) {
          if (lookup_table[r].error_connecting === false) {
            host = r;
          }
        }
        if (!host) {
          self.emit('error', new Error("Failed to connect to any socket in " + full_path));
        }
        var path = full_path.replace(host, '');
        self.socketPath = host;
        self.uri.pathname = path;
        self.uri.href = path;
        self.uri.path = path;
        self.host = '';
        self.hostname = '';
        delete self.host;
        delete self.hostname;
        self._buildRequest();
      }
    };
    if (/^unix:/.test(self.uri.protocol)) {
      self._handleUnixSocketURI(self);
    } else {
      self._buildRequest();
    }
  };
  Request.prototype._updateProtocol = function() {
    var self = this;
    var protocol = self.uri.protocol;
    if (protocol === 'https:' || self.tunnel) {
      if (self.proxy) {
        if (self.setupTunnel())
          return ;
      }
      self.httpModule = https;
      switch (self.agentClass) {
        case ForeverAgent:
          self.agentClass = ForeverAgent.SSL;
          break;
        case http.Agent:
          self.agentClass = https.Agent;
          break;
        default:
          return ;
      }
      if (self.agent)
        self.agent = self.getAgent();
    } else {
      self.httpModule = http;
      switch (self.agentClass) {
        case ForeverAgent.SSL:
          self.agentClass = ForeverAgent;
          break;
        case https.Agent:
          self.agentClass = http.Agent;
          break;
        default:
          return ;
      }
      if (self.agent) {
        self.agent = null;
        self.agent = self.getAgent();
      }
    }
  };
  Request.prototype.getAgent = function() {
    var Agent = this.agentClass;
    var options = {};
    if (this.agentOptions) {
      for (var i in this.agentOptions) {
        options[i] = this.agentOptions[i];
      }
    }
    if (this.ca)
      options.ca = this.ca;
    if (this.ciphers)
      options.ciphers = this.ciphers;
    if (this.secureProtocol)
      options.secureProtocol = this.secureProtocol;
    if (this.secureOptions)
      options.secureOptions = this.secureOptions;
    if (typeof this.rejectUnauthorized !== 'undefined')
      options.rejectUnauthorized = this.rejectUnauthorized;
    if (this.cert && this.key) {
      options.key = this.key;
      options.cert = this.cert;
    }
    var poolKey = '';
    if (Agent !== this.httpModule.Agent) {
      poolKey += Agent.name;
    }
    if (!this.httpModule.globalAgent) {
      options.host = this.host;
      options.port = this.port;
      if (poolKey)
        poolKey += ':';
      poolKey += this.host + ':' + this.port;
    }
    var proxy = this.proxy;
    if (typeof proxy === 'string')
      proxy = url.parse(proxy);
    var isHttps = (proxy && proxy.protocol === 'https:') || this.uri.protocol === 'https:';
    if (isHttps) {
      if (options.ca) {
        if (poolKey)
          poolKey += ':';
        poolKey += options.ca;
      }
      if (typeof options.rejectUnauthorized !== 'undefined') {
        if (poolKey)
          poolKey += ':';
        poolKey += options.rejectUnauthorized;
      }
      if (options.cert)
        poolKey += options.cert.toString('ascii') + options.key.toString('ascii');
      if (options.ciphers) {
        if (poolKey)
          poolKey += ':';
        poolKey += options.ciphers;
      }
      if (options.secureProtocol) {
        if (poolKey)
          poolKey += ':';
        poolKey += options.secureProtocol;
      }
      if (options.secureOptions) {
        if (poolKey)
          poolKey += ':';
        poolKey += options.secureOptions;
      }
    }
    if (this.pool === globalPool && !poolKey && Object.keys(options).length === 0 && this.httpModule.globalAgent) {
      return this.httpModule.globalAgent;
    }
    poolKey = this.uri.protocol + poolKey;
    if (this.pool[poolKey])
      return this.pool[poolKey];
    return this.pool[poolKey] = new Agent(options);
  };
  Request.prototype.start = function() {
    var self = this;
    if (self._aborted)
      return ;
    self._started = true;
    self.method = self.method || 'GET';
    self.href = self.uri.href;
    if (self.src && self.src.stat && self.src.stat.size && !self.hasHeader('content-length')) {
      self.setHeader('content-length', self.src.stat.size);
    }
    if (self._aws) {
      self.aws(self._aws, true);
    }
    var reqOptions = copy(self);
    delete reqOptions.auth;
    debug('make request', self.uri.href);
    self.req = self.httpModule.request(reqOptions, self.onResponse.bind(self));
    if (self.timeout && !self.timeoutTimer) {
      self.timeoutTimer = setTimeout(function() {
        self.req.abort();
        var e = new Error("ETIMEDOUT");
        e.code = "ETIMEDOUT";
        self.emit("error", e);
      }, self.timeout);
      if (self.req.setTimeout) {
        self.req.setTimeout(self.timeout, function() {
          if (self.req) {
            self.req.abort();
            var e = new Error("ESOCKETTIMEDOUT");
            e.code = "ESOCKETTIMEDOUT";
            self.emit("error", e);
          }
        });
      }
    }
    self.req.on('error', self.clientErrorHandler);
    self.req.on('drain', function() {
      self.emit('drain');
    });
    self.on('end', function() {
      if (self.req.connection)
        self.req.connection.removeListener('error', self._parserErrorHandler);
    });
    self.emit('request', self.req);
  };
  Request.prototype.onResponse = function(response) {
    var self = this;
    debug('onResponse', self.uri.href, response.statusCode, response.headers);
    response.on('end', function() {
      debug('response end', self.uri.href, response.statusCode, response.headers);
    });
    if (response.connection && response.connection.listeners('error').indexOf(self._parserErrorHandler) === -1) {
      response.connection.setMaxListeners(0);
      response.connection.once('error', self._parserErrorHandler);
    }
    if (self._aborted) {
      debug('aborted', self.uri.href);
      response.resume();
      return ;
    }
    if (self._paused)
      response.pause();
    else
      response.resume && response.resume();
    self.response = response;
    response.request = self;
    response.toJSON = responseToJSON;
    if (self.httpModule === https && self.strictSSL && (!response.hasOwnProperty('client') || !response.client.authorized)) {
      debug('strict ssl error', self.uri.href);
      var sslErr = response.hasOwnProperty('client') ? response.client.authorizationError : self.uri.href + " does not support SSL";
      self.emit('error', new Error('SSL Error: ' + sslErr));
      return ;
    }
    if (self.setHost)
      self.removeHeader('host');
    if (self.timeout && self.timeoutTimer) {
      clearTimeout(self.timeoutTimer);
      self.timeoutTimer = null;
    }
    var targetCookieJar = (self._jar && self._jar.setCookieSync) ? self._jar : globalCookieJar;
    var addCookie = function(cookie) {
      try {
        targetCookieJar.setCookieSync(cookie, self.uri.href, {ignoreError: true});
      } catch (e) {
        self.emit('error', e);
      }
    };
    response.caseless = caseless(response.headers);
    if (response.caseless.has('set-cookie') && (!self._disableCookies)) {
      var headerName = response.caseless.has('set-cookie');
      if (Array.isArray(response.headers[headerName]))
        response.headers[headerName].forEach(addCookie);
      else
        addCookie(response.headers[headerName]);
    }
    var redirectTo = null;
    if (response.statusCode >= 300 && response.statusCode < 400 && response.caseless.has('location')) {
      var location = response.caseless.get('location');
      debug('redirect', location);
      if (self.followAllRedirects) {
        redirectTo = location;
      } else if (self.followRedirect) {
        switch (self.method) {
          case 'PATCH':
          case 'PUT':
          case 'POST':
          case 'DELETE':
            break;
          default:
            redirectTo = location;
            break;
        }
      }
    } else if (response.statusCode == 401 && self._hasAuth && !self._sentAuth) {
      var authHeader = response.caseless.get('www-authenticate');
      var authVerb = authHeader && authHeader.split(' ')[0].toLowerCase();
      debug('reauth', authVerb);
      switch (authVerb) {
        case 'basic':
          self.auth(self._user, self._pass, true);
          redirectTo = self.uri;
          break;
        case 'bearer':
          self.auth(null, null, true, self._bearer);
          redirectTo = self.uri;
          break;
        case 'digest':
          var challenge = {};
          var re = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
          for (; ; ) {
            var match = re.exec(authHeader);
            if (!match)
              break;
            challenge[match[1]] = match[2] || match[3];
          }
          var ha1 = md5(self._user + ':' + challenge.realm + ':' + self._pass);
          var ha2 = md5(self.method + ':' + self.uri.path);
          var qop = /(^|,)\s*auth\s*($|,)/.test(challenge.qop) && 'auth';
          var nc = qop && '00000001';
          var cnonce = qop && uuid().replace(/-/g, '');
          var digestResponse = qop ? md5(ha1 + ':' + challenge.nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2) : md5(ha1 + ':' + challenge.nonce + ':' + ha2);
          var authValues = {
            username: self._user,
            realm: challenge.realm,
            nonce: challenge.nonce,
            uri: self.uri.path,
            qop: qop,
            response: digestResponse,
            nc: nc,
            cnonce: cnonce,
            algorithm: challenge.algorithm,
            opaque: challenge.opaque
          };
          authHeader = [];
          for (var k in authValues) {
            if (!authValues[k]) {} else if (k === 'qop' || k === 'nc' || k === 'algorithm') {
              authHeader.push(k + '=' + authValues[k]);
            } else {
              authHeader.push(k + '="' + authValues[k] + '"');
            }
          }
          authHeader = 'Digest ' + authHeader.join(', ');
          self.setHeader('authorization', authHeader);
          self._sentAuth = true;
          redirectTo = self.uri;
          break;
      }
    }
    if (redirectTo && self.allowRedirect.call(self, response)) {
      debug('redirect to', redirectTo);
      if (self._paused)
        response.resume();
      if (self._redirectsFollowed >= self.maxRedirects) {
        self.emit('error', new Error("Exceeded maxRedirects. Probably stuck in a redirect loop " + self.uri.href));
        return ;
      }
      self._redirectsFollowed += 1;
      if (!isUrl.test(redirectTo)) {
        redirectTo = url.resolve(self.uri.href, redirectTo);
      }
      var uriPrev = self.uri;
      self.uri = url.parse(redirectTo);
      if (self.uri.protocol !== uriPrev.protocol) {
        self._updateProtocol();
      }
      self.redirects.push({
        statusCode: response.statusCode,
        redirectUri: redirectTo
      });
      if (self.followAllRedirects && response.statusCode != 401 && response.statusCode != 307)
        self.method = 'GET';
      delete self.src;
      delete self.req;
      delete self.agent;
      delete self._started;
      if (response.statusCode != 401 && response.statusCode != 307) {
        delete self.body;
        delete self._form;
        if (self.headers) {
          self.removeHeader('host');
          self.removeHeader('content-type');
          self.removeHeader('content-length');
        }
      }
      self.emit('redirect');
      self.init();
      return ;
    } else {
      self._redirectsFollowed = self._redirectsFollowed || 0;
      response.on('close', function() {
        if (!self._ended)
          self.response.emit('end');
      });
      response.on('end', function() {
        self._ended = true;
      });
      var dataStream;
      if (self.gzip) {
        var contentEncoding = response.headers["content-encoding"] || "identity";
        contentEncoding = contentEncoding.trim().toLowerCase();
        if (contentEncoding === "gzip") {
          dataStream = zlib.createGunzip();
          response.pipe(dataStream);
        } else {
          if (contentEncoding !== "identity") {
            debug("ignoring unrecognized Content-Encoding " + contentEncoding);
          }
          dataStream = response;
        }
      } else {
        dataStream = response;
      }
      if (self.encoding) {
        if (self.dests.length !== 0) {
          console.error("Ignoring encoding parameter as this stream is being piped to another stream which makes the encoding option invalid.");
        } else if (dataStream.setEncoding) {
          dataStream.setEncoding(self.encoding);
        } else {
          dataStream = dataStream.pipe(stringstream(self.encoding));
        }
      }
      self.emit('response', response);
      self.dests.forEach(function(dest) {
        self.pipeDest(dest);
      });
      dataStream.on("data", function(chunk) {
        self._destdata = true;
        self.emit("data", chunk);
      });
      dataStream.on("end", function(chunk) {
        self.emit("end", chunk);
      });
      dataStream.on("error", function(error) {
        self.emit("error", error);
      });
      dataStream.on("close", function() {
        self.emit("close");
      });
      if (self.callback) {
        var buffer = bl(),
            strings = [];
        ;
        self.on("data", function(chunk) {
          if (Buffer.isBuffer(chunk))
            buffer.append(chunk);
          else
            strings.push(chunk);
        });
        self.on("end", function() {
          debug('end event', self.uri.href);
          if (self._aborted) {
            debug('aborted', self.uri.href);
            return ;
          }
          if (buffer.length) {
            debug('has body', self.uri.href, buffer.length);
            if (self.encoding === null) {
              response.body = buffer.slice();
            } else {
              response.body = buffer.toString(self.encoding);
            }
          } else if (strings.length) {
            if (self.encoding === 'utf8' && strings[0].length > 0 && strings[0][0] === "\uFEFF") {
              strings[0] = strings[0].substring(1);
            }
            response.body = strings.join('');
          }
          if (self._json) {
            try {
              response.body = JSON.parse(response.body);
            } catch (e) {}
          }
          debug('emitting complete', self.uri.href);
          if (response.body == undefined && !self._json) {
            response.body = "";
          }
          self.emit('complete', response, response.body);
        });
      } else {
        self.on("end", function() {
          if (self._aborted) {
            debug('aborted', self.uri.href);
            return ;
          }
          self.emit('complete', response);
        });
      }
    }
    debug('finish init function', self.uri.href);
  };
  Request.prototype.abort = function() {
    this._aborted = true;
    if (this.req) {
      this.req.abort();
    } else if (this.response) {
      this.response.abort();
    }
    this.emit("abort");
  };
  Request.prototype.pipeDest = function(dest) {
    var response = this.response;
    if (dest.headers && !dest.headersSent) {
      if (response.caseless.has('content-type')) {
        var ctname = response.caseless.has('content-type');
        if (dest.setHeader)
          dest.setHeader(ctname, response.headers[ctname]);
        else
          dest.headers[ctname] = response.headers[ctname];
      }
      if (response.caseless.has('content-length')) {
        var clname = response.caseless.has('content-length');
        if (dest.setHeader)
          dest.setHeader(clname, response.headers[clname]);
        else
          dest.headers[clname] = response.headers[clname];
      }
    }
    if (dest.setHeader && !dest.headersSent) {
      for (var i in response.headers) {
        if (!this.gzip || i !== 'content-encoding') {
          dest.setHeader(i, response.headers[i]);
        }
      }
      dest.statusCode = response.statusCode;
    }
    if (this.pipefilter)
      this.pipefilter(response, dest);
  };
  Request.prototype.qs = function(q, clobber) {
    var base;
    if (!clobber && this.uri.query)
      base = qs.parse(this.uri.query);
    else
      base = {};
    for (var i in q) {
      base[i] = q[i];
    }
    if (qs.stringify(base) === '') {
      return this;
    }
    this.uri = url.parse(this.uri.href.split('?')[0] + '?' + qs.stringify(base));
    this.url = this.uri;
    this.path = this.uri.path;
    return this;
  };
  Request.prototype.form = function(form) {
    if (form) {
      this.setHeader('content-type', 'application/x-www-form-urlencoded; charset=utf-8');
      this.body = (typeof form === 'string') ? form.toString('utf8') : qs.stringify(form).toString('utf8');
      return this;
    }
    this._form = new FormData();
    return this._form;
  };
  Request.prototype.multipart = function(multipart) {
    var self = this;
    self.body = [];
    if (!self.hasHeader('content-type')) {
      self.setHeader('content-type', 'multipart/related; boundary=' + self.boundary);
    } else {
      var headerName = self.hasHeader('content-type');
      self.setHeader(headerName, self.headers[headerName].split(';')[0] + '; boundary=' + self.boundary);
    }
    if (!multipart.forEach)
      throw new Error('Argument error, options.multipart.');
    if (self.preambleCRLF) {
      self.body.push(new Buffer('\r\n'));
    }
    multipart.forEach(function(part) {
      var body = part.body;
      if (body == null)
        throw Error('Body attribute missing in multipart.');
      delete part.body;
      var preamble = '--' + self.boundary + '\r\n';
      Object.keys(part).forEach(function(key) {
        preamble += key + ': ' + part[key] + '\r\n';
      });
      preamble += '\r\n';
      self.body.push(new Buffer(preamble));
      self.body.push(new Buffer(body));
      self.body.push(new Buffer('\r\n'));
    });
    self.body.push(new Buffer('--' + self.boundary + '--'));
    return self;
  };
  Request.prototype.json = function(val) {
    var self = this;
    if (!self.hasHeader('accept'))
      self.setHeader('accept', 'application/json');
    this._json = true;
    if (typeof val === 'boolean') {
      if (typeof this.body === 'object') {
        this.body = safeStringify(this.body);
        if (!self.hasHeader('content-type'))
          self.setHeader('content-type', 'application/json');
      }
    } else {
      this.body = safeStringify(val);
      if (!self.hasHeader('content-type'))
        self.setHeader('content-type', 'application/json');
    }
    return this;
  };
  Request.prototype.getHeader = function(name, headers) {
    var result,
        re,
        match;
    if (!headers)
      headers = this.headers;
    Object.keys(headers).forEach(function(key) {
      if (key.length !== name.length)
        return ;
      re = new RegExp(name, 'i');
      match = key.match(re);
      if (match)
        result = headers[key];
    });
    return result;
  };
  var getHeader = Request.prototype.getHeader;
  Request.prototype.auth = function(user, pass, sendImmediately, bearer) {
    if (bearer !== undefined) {
      this._bearer = bearer;
      this._hasAuth = true;
      if (sendImmediately || typeof sendImmediately == 'undefined') {
        if (typeof bearer === 'function') {
          bearer = bearer();
        }
        this.setHeader('authorization', 'Bearer ' + bearer);
        this._sentAuth = true;
      }
      return this;
    }
    if (typeof user !== 'string' || (pass !== undefined && typeof pass !== 'string')) {
      throw new Error('auth() received invalid user or password');
    }
    this._user = user;
    this._pass = pass;
    this._hasAuth = true;
    var header = typeof pass !== 'undefined' ? user + ':' + pass : user;
    if (sendImmediately || typeof sendImmediately == 'undefined') {
      this.setHeader('authorization', 'Basic ' + toBase64(header));
      this._sentAuth = true;
    }
    return this;
  };
  Request.prototype.aws = function(opts, now) {
    if (!now) {
      this._aws = opts;
      return this;
    }
    var date = new Date();
    this.setHeader('date', date.toUTCString());
    var auth = {
      key: opts.key,
      secret: opts.secret,
      verb: this.method.toUpperCase(),
      date: date,
      contentType: this.getHeader('content-type') || '',
      md5: this.getHeader('content-md5') || '',
      amazonHeaders: aws.canonicalizeHeaders(this.headers)
    };
    var path = this.uri.path;
    if (opts.bucket && path) {
      auth.resource = '/' + opts.bucket + path;
    } else if (opts.bucket && !path) {
      auth.resource = '/' + opts.bucket;
    } else if (!opts.bucket && path) {
      auth.resource = path;
    } else if (!opts.bucket && !path) {
      auth.resource = '/';
    }
    auth.resource = aws.canonicalizeResource(auth.resource);
    this.setHeader('authorization', aws.authorization(auth));
    return this;
  };
  Request.prototype.httpSignature = function(opts) {
    var req = this;
    httpSignature.signRequest({
      getHeader: function(header) {
        return getHeader(header, req.headers);
      },
      setHeader: function(header, value) {
        req.setHeader(header, value);
      },
      method: this.method,
      path: this.path
    }, opts);
    debug('httpSignature authorization', this.getHeader('authorization'));
    return this;
  };
  Request.prototype.hawk = function(opts) {
    this.setHeader('Authorization', hawk.client.header(this.uri, this.method, opts).field);
  };
  Request.prototype.oauth = function(_oauth) {
    var form,
        query;
    if (this.hasHeader('content-type') && this.getHeader('content-type').slice(0, 'application/x-www-form-urlencoded'.length) === 'application/x-www-form-urlencoded') {
      form = this.body;
    }
    if (this.uri.query) {
      query = this.uri.query;
    }
    var oa = {};
    for (var i in _oauth)
      oa['oauth_' + i] = _oauth[i];
    if ('oauth_realm' in oa)
      delete oa.oauth_realm;
    if (!oa.oauth_version)
      oa.oauth_version = '1.0';
    if (!oa.oauth_timestamp)
      oa.oauth_timestamp = Math.floor(Date.now() / 1000).toString();
    if (!oa.oauth_nonce)
      oa.oauth_nonce = uuid().replace(/-/g, '');
    oa.oauth_signature_method = 'HMAC-SHA1';
    var consumer_secret = oa.oauth_consumer_secret;
    delete oa.oauth_consumer_secret;
    var token_secret = oa.oauth_token_secret;
    delete oa.oauth_token_secret;
    var baseurl = this.uri.protocol + '//' + this.uri.host + this.uri.pathname;
    var params = qs.parse([].concat(query, form, qs.stringify(oa)).join('&'));
    var signature = oauth.hmacsign(this.method, baseurl, params, consumer_secret, token_secret);
    var realm = _oauth.realm ? 'realm="' + _oauth.realm + '",' : '';
    var authHeader = 'OAuth ' + realm + Object.keys(oa).sort().map(function(i) {
      return i + '="' + oauth.rfc3986(oa[i]) + '"';
    }).join(',');
    authHeader += ',oauth_signature="' + oauth.rfc3986(signature) + '"';
    this.setHeader('Authorization', authHeader);
    return this;
  };
  Request.prototype.jar = function(jar) {
    var cookies;
    if (this._redirectsFollowed === 0) {
      this.originalCookieHeader = this.getHeader('cookie');
    }
    if (!jar) {
      cookies = false;
      this._disableCookies = true;
    } else {
      var targetCookieJar = (jar && jar.getCookieStringSync) ? jar : globalCookieJar;
      var urihref = this.uri.href;
      if (targetCookieJar) {
        cookies = targetCookieJar.getCookieStringSync(urihref);
      }
    }
    if (cookies && cookies.length) {
      if (this.originalCookieHeader) {
        this.setHeader('cookie', this.originalCookieHeader + '; ' + cookies);
      } else {
        this.setHeader('cookie', cookies);
      }
    }
    this._jar = jar;
    return this;
  };
  Request.prototype.pipe = function(dest, opts) {
    if (this.response) {
      if (this._destdata) {
        throw new Error("You cannot pipe after data has been emitted from the response.");
      } else if (this._ended) {
        throw new Error("You cannot pipe after the response has been ended.");
      } else {
        stream.Stream.prototype.pipe.call(this, dest, opts);
        this.pipeDest(dest);
        return dest;
      }
    } else {
      this.dests.push(dest);
      stream.Stream.prototype.pipe.call(this, dest, opts);
      return dest;
    }
  };
  Request.prototype.write = function() {
    if (!this._started)
      this.start();
    return this.req.write.apply(this.req, arguments);
  };
  Request.prototype.end = function(chunk) {
    if (chunk)
      this.write(chunk);
    if (!this._started)
      this.start();
    this.req.end();
  };
  Request.prototype.pause = function() {
    if (!this.response)
      this._paused = true;
    else
      this.response.pause.apply(this.response, arguments);
  };
  Request.prototype.resume = function() {
    if (!this.response)
      this._paused = false;
    else
      this.response.resume.apply(this.response, arguments);
  };
  Request.prototype.destroy = function() {
    if (!this._ended)
      this.end();
    else if (this.response)
      this.response.destroy();
  };
  Request.prototype.toJSON = requestToJSON;
  Request.defaultProxyHeaderWhiteList = defaultProxyHeaderWhiteList.slice();
  module.exports = Request;
})(require("buffer").Buffer, require("process"));
