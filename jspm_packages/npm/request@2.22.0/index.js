/* */ 
(function(Buffer, process) {
  var http = require("http"),
      https = false,
      tls = false,
      url = require("url"),
      util = require("util"),
      stream = require("stream"),
      qs = require("qs"),
      querystring = require("querystring"),
      crypto = require("crypto"),
      oauth = require("oauth-sign"),
      hawk = require("hawk"),
      aws = require("aws-sign"),
      httpSignature = require("http-signature"),
      uuid = require("node-uuid"),
      mime = require("mime"),
      tunnel = require("tunnel-agent"),
      safeStringify = require("json-stringify-safe"),
      ForeverAgent = require("forever-agent"),
      FormData = require("form-data"),
      Cookie = require("cookie-jar"),
      CookieJar = Cookie.Jar,
      cookieJar = new CookieJar;
  ;
  try {
    https = require("https");
  } catch (e) {}
  try {
    tls = require("tls");
  } catch (e) {}
  var debug;
  if (/\brequest\b/.test(process.env.NODE_DEBUG)) {
    debug = function() {
      console.error('REQUEST %s', util.format.apply(util, arguments));
    };
  } else {
    debug = function() {};
  }
  function toBase64(str) {
    return (new Buffer(str || "", "ascii")).toString("base64");
  }
  function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
  }
  if (https && !https.Agent) {
    https.Agent = function(options) {
      http.Agent.call(this, options);
    };
    util.inherits(https.Agent, http.Agent);
    https.Agent.prototype._getConnection = function(host, port, cb) {
      var s = tls.connect(port, host, this.options, function() {
        if (cb)
          cb();
      });
      return s;
    };
  }
  function isReadStream(rs) {
    if (rs.readable && rs.path && rs.mode) {
      return true;
    }
  }
  function copy(obj) {
    var o = {};
    Object.keys(obj).forEach(function(i) {
      o[i] = obj[i];
    });
    return o;
  }
  var isUrl = /^https?:/;
  var globalPool = {};
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
    this.init(options);
  }
  util.inherits(Request, stream.Stream);
  Request.prototype.init = function(options) {
    var self = this;
    if (!options)
      options = {};
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
    if (self.proxy) {
      if (typeof self.proxy == 'string')
        self.proxy = url.parse(self.proxy);
      if (http.globalAgent && self.uri.protocol === "https:") {
        var tunnelFn = self.proxy.protocol === "http:" ? tunnel.httpsOverHttp : tunnel.httpsOverHttps;
        var tunnelOptions = {
          proxy: {
            host: self.proxy.hostname,
            port: +self.proxy.port,
            proxyAuth: self.proxy.auth,
            headers: {Host: self.uri.hostname + ':' + (self.uri.port || self.uri.protocol === 'https:' ? 443 : 80)}
          },
          rejectUnauthorized: self.rejectUnauthorized,
          ca: this.ca
        };
        self.agent = tunnelFn(tunnelOptions);
        self.tunnel = true;
      }
    }
    if (!self.uri.host || !self.uri.pathname) {
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
    self.followRedirect = (self.followRedirect !== undefined) ? self.followRedirect : true;
    self.followAllRedirects = (self.followAllRedirects !== undefined) ? self.followAllRedirects : false;
    if (self.followRedirect || self.followAllRedirects)
      self.redirects = self.redirects || [];
    self.headers = self.headers ? copy(self.headers) : {};
    self.setHost = false;
    if (!(self.headers.host || self.headers.Host)) {
      self.headers.host = self.uri.hostname;
      if (self.uri.port) {
        if (!(self.uri.port === 80 && self.uri.protocol === 'http:') && !(self.uri.port === 443 && self.uri.protocol === 'https:'))
          self.headers.host += (':' + self.uri.port);
      }
      self.setHost = true;
    }
    self.jar(self._jar || options.jar);
    if (!self.uri.pathname) {
      self.uri.pathname = '/';
    }
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
      self.auth((options.auth.user === "") ? options.auth.user : (options.auth.user || options.auth.username), options.auth.pass || options.auth.password, options.auth.sendImmediately);
    }
    if (self.uri.auth && !self.headers.authorization) {
      var authPieces = self.uri.auth.split(':').map(function(item) {
        return querystring.unescape(item);
      });
      self.auth(authPieces[0], authPieces.slice(1).join(':'), true);
    }
    if (self.proxy && self.proxy.auth && !self.headers['proxy-authorization'] && !self.tunnel) {
      self.headers['proxy-authorization'] = "Basic " + toBase64(self.proxy.auth.split(':').map(function(item) {
        return querystring.unescape(item);
      }).join(':'));
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
        if (!self.headers['content-length'] && !self.headers['Content-Length'])
          self.headers['content-length'] = length;
      } else {
        throw new Error('Argument error, options.body.');
      }
    }
    var protocol = self.proxy && !self.tunnel ? self.proxy.protocol : self.uri.protocol,
        defaultModules = {
          'http:': http,
          'https:': https
        },
        httpModules = self.httpModules || {};
    ;
    self.httpModule = httpModules[protocol] || defaultModules[protocol];
    if (!self.httpModule)
      return this.emit('error', new Error("Invalid protocol"));
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
        if (!self.headers['content-type'] && !self.headers['Content-Type'])
          self.headers['content-type'] = mime.lookup(src.path);
      } else {
        if (src.headers) {
          for (var i in src.headers) {
            if (!self.headers[i]) {
              self.headers[i] = src.headers[i];
            }
          }
        }
        if (self._json && !self.headers['content-type'] && !self.headers['Content-Type'])
          self.headers['content-type'] = 'application/json';
        if (src.method && !self.explicitMethod) {
          self.method = src.method;
        }
      }
    });
    process.nextTick(function() {
      if (self._aborted)
        return ;
      if (self._form) {
        self.setHeaders(self._form.getHeaders());
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
          self.headers['content-length'] = 0;
        }
        self.end();
      }
      self.ntick = true;
    });
  };
  Request.prototype._updateProtocol = function() {
    var self = this;
    var protocol = self.uri.protocol;
    if (protocol === 'https:') {
      if (self.proxy) {
        self.tunnel = true;
        var tunnelFn = self.proxy.protocol === 'http:' ? tunnel.httpsOverHttp : tunnel.httpsOverHttps;
        var tunnelOptions = {
          proxy: {
            host: self.proxy.hostname,
            port: +self.proxy.port,
            proxyAuth: self.proxy.auth
          },
          rejectUnauthorized: self.rejectUnauthorized,
          ca: self.ca
        };
        self.agent = tunnelFn(tunnelOptions);
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
      if (self.tunnel)
        self.tunnel = false;
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
      if (options.secureOptions) {
        if (poolKey)
          poolKey += ':';
        poolKey += options.secureOptions;
      }
    }
    if (!poolKey && Object.keys(options).length === 0 && this.httpModule.globalAgent) {
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
    if (self.src && self.src.stat && self.src.stat.size && !self.headers['content-length'] && !self.headers['Content-Length']) {
      self.headers['content-length'] = self.src.stat.size;
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
    if (response.connection.listeners('error').indexOf(self._parserErrorHandler) === -1) {
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
      response.resume();
    self.response = response;
    response.request = self;
    response.toJSON = toJSON;
    if (self.httpModule === https && self.strictSSL && !response.client.authorized) {
      debug('strict ssl error', self.uri.href);
      var sslErr = response.client.authorizationError;
      self.emit('error', new Error('SSL Error: ' + sslErr));
      return ;
    }
    if (self.setHost)
      delete self.headers.host;
    if (self.timeout && self.timeoutTimer) {
      clearTimeout(self.timeoutTimer);
      self.timeoutTimer = null;
    }
    var addCookie = function(cookie) {
      if (self._jar)
        self._jar.add(new Cookie(cookie));
      else
        cookieJar.add(new Cookie(cookie));
    };
    if (response.headers['set-cookie'] && (!self._disableCookies)) {
      if (Array.isArray(response.headers['set-cookie']))
        response.headers['set-cookie'].forEach(addCookie);
      else
        addCookie(response.headers['set-cookie']);
    }
    var redirectTo = null;
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      debug('redirect', response.headers.location);
      if (self.followAllRedirects) {
        redirectTo = response.headers.location;
      } else if (self.followRedirect) {
        switch (self.method) {
          case 'PATCH':
          case 'PUT':
          case 'POST':
          case 'DELETE':
            break;
          default:
            redirectTo = response.headers.location;
            break;
        }
      }
    } else if (response.statusCode == 401 && self._hasAuth && !self._sentAuth) {
      var authHeader = response.headers['www-authenticate'];
      var authVerb = authHeader && authHeader.split(' ')[0];
      debug('reauth', authVerb);
      switch (authVerb) {
        case 'Basic':
          self.auth(self._user, self._pass, true);
          redirectTo = self.uri;
          break;
        case 'Digest':
          var matches = authHeader.match(/([a-z0-9_-]+)="([^"]+)"/gi);
          var challenge = {};
          for (var i = 0; i < matches.length; i++) {
            var eqPos = matches[i].indexOf('=');
            var key = matches[i].substring(0, eqPos);
            var quotedValue = matches[i].substring(eqPos + 1);
            challenge[key] = quotedValue.substring(1, quotedValue.length - 1);
          }
          var ha1 = md5(self._user + ':' + challenge.realm + ':' + self._pass);
          var ha2 = md5(self.method + ':' + self.uri.path);
          var digestResponse = md5(ha1 + ':' + challenge.nonce + ':1::auth:' + ha2);
          var authValues = {
            username: self._user,
            realm: challenge.realm,
            nonce: challenge.nonce,
            uri: self.uri.path,
            qop: challenge.qop,
            response: digestResponse,
            nc: 1,
            cnonce: ''
          };
          authHeader = [];
          for (var k in authValues) {
            authHeader.push(k + '="' + authValues[k] + '"');
          }
          authHeader = 'Digest ' + authHeader.join(', ');
          self.setHeader('authorization', authHeader);
          self._sentAuth = true;
          redirectTo = self.uri;
          break;
      }
    }
    if (redirectTo) {
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
      if (self.followAllRedirects && response.statusCode != 401)
        self.method = 'GET';
      delete self.src;
      delete self.req;
      delete self.agent;
      delete self._started;
      if (response.statusCode != 401) {
        delete self.body;
        delete self._form;
        if (self.headers) {
          delete self.headers.host;
          delete self.headers['content-type'];
          delete self.headers['content-length'];
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
      if (self.encoding) {
        if (self.dests.length !== 0) {
          console.error("Ignoring encoding parameter as this stream is being piped to another stream which makes the encoding option invalid.");
        } else {
          response.setEncoding(self.encoding);
        }
      }
      self.emit('response', response);
      self.dests.forEach(function(dest) {
        self.pipeDest(dest);
      });
      response.on("data", function(chunk) {
        self._destdata = true;
        self.emit("data", chunk);
      });
      response.on("end", function(chunk) {
        self._ended = true;
        self.emit("end", chunk);
      });
      response.on("close", function() {
        self.emit("close");
      });
      if (self.callback) {
        var buffer = [];
        var bodyLen = 0;
        self.on("data", function(chunk) {
          buffer.push(chunk);
          bodyLen += chunk.length;
        });
        self.on("end", function() {
          debug('end event', self.uri.href);
          if (self._aborted) {
            debug('aborted', self.uri.href);
            return ;
          }
          if (buffer.length && Buffer.isBuffer(buffer[0])) {
            debug('has body', self.uri.href, bodyLen);
            var body = new Buffer(bodyLen);
            var i = 0;
            buffer.forEach(function(chunk) {
              chunk.copy(body, i, 0, chunk.length);
              i += chunk.length;
            });
            if (self.encoding === null) {
              response.body = body;
            } else {
              response.body = body.toString(self.encoding);
            }
          } else if (buffer.length) {
            if (self.encoding === 'utf8' && buffer[0].length > 0 && buffer[0][0] === "\uFEFF") {
              buffer[0] = buffer[0].substring(1);
            }
            response.body = buffer.join('');
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
    if (dest.headers) {
      dest.headers['content-type'] = response.headers['content-type'];
      if (response.headers['content-length']) {
        dest.headers['content-length'] = response.headers['content-length'];
      }
    }
    if (dest.setHeader) {
      for (var i in response.headers) {
        dest.setHeader(i, response.headers[i]);
      }
      dest.statusCode = response.statusCode;
    }
    if (this.pipefilter)
      this.pipefilter(response, dest);
  };
  Request.prototype.setHeader = function(name, value, clobber) {
    if (clobber === undefined)
      clobber = true;
    if (clobber || !this.headers.hasOwnProperty(name))
      this.headers[name] = value;
    else
      this.headers[name] += ',' + value;
    return this;
  };
  Request.prototype.setHeaders = function(headers) {
    for (var i in headers) {
      this.setHeader(i, headers[i]);
    }
    return this;
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
      this.headers['content-type'] = 'application/x-www-form-urlencoded; charset=utf-8';
      this.body = qs.stringify(form).toString('utf8');
      return this;
    }
    this._form = new FormData();
    return this._form;
  };
  Request.prototype.multipart = function(multipart) {
    var self = this;
    self.body = [];
    if (!self.headers['content-type']) {
      self.headers['content-type'] = 'multipart/related; boundary=' + self.boundary;
    } else {
      self.headers['content-type'] = self.headers['content-type'].split(';')[0] + '; boundary=' + self.boundary;
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
    var setAcceptHeader = function() {
      if (!self.headers['accept'] && !self.headers['Accept']) {
        self.setHeader('accept', 'application/json');
      }
    };
    setAcceptHeader();
    this._json = true;
    if (typeof val === 'boolean') {
      if (typeof this.body === 'object') {
        setAcceptHeader();
        this.body = safeStringify(this.body);
        self.setHeader('content-type', 'application/json');
      }
    } else {
      setAcceptHeader();
      this.body = safeStringify(val);
      self.setHeader('content-type', 'application/json');
    }
    return this;
  };
  function getHeader(name, headers) {
    var result,
        re,
        match;
    Object.keys(headers).forEach(function(key) {
      re = new RegExp(name, 'i');
      match = key.match(re);
      if (match)
        result = headers[key];
    });
    return result;
  }
  Request.prototype.auth = function(user, pass, sendImmediately) {
    if (typeof user !== 'string' || (pass !== undefined && typeof pass !== 'string')) {
      throw new Error('auth() received invalid user or password');
    }
    this._user = user;
    this._pass = pass;
    this._hasAuth = true;
    if (sendImmediately || typeof sendImmediately == 'undefined') {
      this.setHeader('authorization', 'Basic ' + toBase64(user + ':' + pass));
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
      contentType: getHeader('content-type', this.headers) || '',
      md5: getHeader('content-md5', this.headers) || '',
      amazonHeaders: aws.canonicalizeHeaders(this.headers)
    };
    if (opts.bucket && this.path) {
      auth.resource = '/' + opts.bucket + this.path;
    } else if (opts.bucket && !this.path) {
      auth.resource = '/' + opts.bucket;
    } else if (!opts.bucket && this.path) {
      auth.resource = this.path;
    } else if (!opts.bucket && !this.path) {
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
    debug('httpSignature authorization', getHeader('authorization', this.headers));
    return this;
  };
  Request.prototype.hawk = function(opts) {
    this.headers.Authorization = hawk.client.header(this.uri, this.method, opts).field;
  };
  Request.prototype.oauth = function(_oauth) {
    var form;
    if (this.headers['content-type'] && this.headers['content-type'].slice(0, 'application/x-www-form-urlencoded'.length) === 'application/x-www-form-urlencoded') {
      form = qs.parse(this.body);
    }
    if (this.uri.query) {
      form = qs.parse(this.uri.query);
    }
    if (!form)
      form = {};
    var oa = {};
    for (var i in form)
      oa[i] = form[i];
    for (var i in _oauth)
      oa['oauth_' + i] = _oauth[i];
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
    var timestamp = oa.oauth_timestamp;
    var baseurl = this.uri.protocol + '//' + this.uri.host + this.uri.pathname;
    var signature = oauth.hmacsign(this.method, baseurl, oa, consumer_secret, token_secret);
    for (var i in form) {
      if (i.slice(0, 'oauth_') in _oauth) {} else {
        delete oa['oauth_' + i];
        if (i !== 'x_auth_mode')
          delete oa[i];
      }
    }
    oa.oauth_timestamp = timestamp;
    this.headers.Authorization = 'OAuth ' + Object.keys(oa).sort().map(function(i) {
      return i + '="' + oauth.rfc3986(oa[i]) + '"';
    }).join(',');
    this.headers.Authorization += ',oauth_signature="' + oauth.rfc3986(signature) + '"';
    return this;
  };
  Request.prototype.jar = function(jar) {
    var cookies;
    if (this._redirectsFollowed === 0) {
      this.originalCookieHeader = this.headers.cookie;
    }
    if (jar === false) {
      cookies = false;
      this._disableCookies = true;
    } else if (jar) {
      cookies = jar.get({url: this.uri.href});
    } else {
      cookies = cookieJar.get({url: this.uri.href});
    }
    if (cookies && cookies.length) {
      var cookieString = cookies.map(function(c) {
        return c.name + "=" + c.value;
      }).join("; ");
      if (this.originalCookieHeader) {
        this.headers.cookie = this.originalCookieHeader + '; ' + cookieString;
      } else {
        this.headers.cookie = cookieString;
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
  function initParams(uri, options, callback) {
    if ((typeof options === 'function') && !callback)
      callback = options;
    if (options && typeof options === 'object') {
      options.uri = uri;
    } else if (typeof uri === 'string') {
      options = {uri: uri};
    } else {
      options = uri;
      uri = options.uri;
    }
    return {
      uri: uri,
      options: options,
      callback: callback
    };
  }
  function request(uri, options, callback) {
    if (typeof uri === 'undefined')
      throw new Error('undefined is not a valid uri or options object.');
    if ((typeof options === 'function') && !callback)
      callback = options;
    if (options && typeof options === 'object') {
      options.uri = uri;
    } else if (typeof uri === 'string') {
      options = {uri: uri};
    } else {
      options = uri;
    }
    options = copy(options);
    if (callback)
      options.callback = callback;
    var r = new Request(options);
    return r;
  }
  module.exports = request;
  request.Request = Request;
  request.debug = process.env.NODE_DEBUG && /request/.test(process.env.NODE_DEBUG);
  request.initParams = initParams;
  request.defaults = function(options, requester) {
    var def = function(method) {
      var d = function(uri, opts, callback) {
        var params = initParams(uri, opts, callback);
        for (var i in options) {
          if (params.options[i] === undefined)
            params.options[i] = options[i];
        }
        if (typeof requester === 'function') {
          if (method === request) {
            method = requester;
          } else {
            params.options._requester = requester;
          }
        }
        return method(params.options, params.callback);
      };
      return d;
    };
    var de = def(request);
    de.get = def(request.get);
    de.patch = def(request.patch);
    de.post = def(request.post);
    de.put = def(request.put);
    de.head = def(request.head);
    de.del = def(request.del);
    de.cookie = def(request.cookie);
    de.jar = request.jar;
    return de;
  };
  request.forever = function(agentOptions, optionsArg) {
    var options = {};
    if (optionsArg) {
      for (option in optionsArg) {
        options[option] = optionsArg[option];
      }
    }
    if (agentOptions)
      options.agentOptions = agentOptions;
    options.forever = true;
    return request.defaults(options);
  };
  request.get = request;
  request.post = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'POST';
    return request(params.uri || null, params.options, params.callback);
  };
  request.put = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'PUT';
    return request(params.uri || null, params.options, params.callback);
  };
  request.patch = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'PATCH';
    return request(params.uri || null, params.options, params.callback);
  };
  request.head = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'HEAD';
    if (params.options.body || params.options.requestBodyStream || (params.options.json && typeof params.options.json !== 'boolean') || params.options.multipart) {
      throw new Error("HTTP HEAD requests MUST NOT include a request body.");
    }
    return request(params.uri || null, params.options, params.callback);
  };
  request.del = function(uri, options, callback) {
    var params = initParams(uri, options, callback);
    params.options.method = 'DELETE';
    if (typeof params.options._requester === 'function') {
      request = params.options._requester;
    }
    return request(params.uri || null, params.options, params.callback);
  };
  request.jar = function() {
    return new CookieJar;
  };
  request.cookie = function(str) {
    if (str && str.uri)
      str = str.uri;
    if (typeof str !== 'string')
      throw new Error("The cookie function only accepts STRING as param");
    return new Cookie(str);
  };
  function getSafe(self, uuid) {
    if (typeof self === 'object' || typeof self === 'function')
      var safe = {};
    if (Array.isArray(self))
      var safe = [];
    var recurse = [];
    Object.defineProperty(self, uuid, {});
    var attrs = Object.keys(self).filter(function(i) {
      if (i === uuid)
        return false;
      if ((typeof self[i] !== 'object' && typeof self[i] !== 'function') || self[i] === null)
        return true;
      return !(Object.getOwnPropertyDescriptor(self[i], uuid));
    });
    for (var i = 0; i < attrs.length; i++) {
      if ((typeof self[attrs[i]] !== 'object' && typeof self[attrs[i]] !== 'function') || self[attrs[i]] === null) {
        safe[attrs[i]] = self[attrs[i]];
      } else {
        recurse.push(attrs[i]);
        Object.defineProperty(self[attrs[i]], uuid, {});
      }
    }
    for (var i = 0; i < recurse.length; i++) {
      safe[recurse[i]] = getSafe(self[recurse[i]], uuid);
    }
    return safe;
  }
  function toJSON() {
    return getSafe(this, '__' + (((1 + Math.random()) * 0x10000) | 0).toString(16));
  }
  Request.prototype.toJSON = toJSON;
})(require("buffer").Buffer, require("process"));
