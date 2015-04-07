/* */ 
'use strict';
var net = require("net");
var urlParse = require("url").parse;
var pubsuffix = require("./pubsuffix");
var Store = require("./store").Store;
var punycode;
try {
  punycode = require("punycode");
} catch (e) {
  console.warn("cookie: can't load punycode; won't use punycode for domain normalization");
}
var DATE_DELIM = /[\x09\x20-\x2F\x3B-\x40\x5B-\x60\x7B-\x7E]/;
var TOKEN = /[\x21\x23-\x26\x2A\x2B\x2D\x2E\x30-\x39\x41-\x5A\x5E-\x7A\x7C\x7E]/;
var COOKIE_OCTET = /[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]/;
var COOKIE_OCTETS = new RegExp('^' + COOKIE_OCTET.source + '$');
var COOKIE_PAIR_STRICT = new RegExp('^(' + TOKEN.source + '+)=("?)(' + COOKIE_OCTET.source + '*)\\2$');
var COOKIE_PAIR = /^([^=\s]+)\s*=\s*("?)\s*(.*)\s*\2\s*$/;
var NON_CTL_SEMICOLON = /[\x20-\x3A\x3C-\x7E]+/;
var EXTENSION_AV = NON_CTL_SEMICOLON;
var PATH_VALUE = NON_CTL_SEMICOLON;
var TRAILING_SEMICOLON = /;+$/;
var DAY_OF_MONTH = /^(0?[1-9]|[12][0-9]|3[01])$/;
var TIME = /(0?[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])/;
var STRICT_TIME = /^(0?[0-9]|1[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
var MONTH = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i;
var MONTH_TO_NUM = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};
var NUM_TO_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var NUM_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var YEAR = /^([1-9][0-9]{1,3})$/;
var MAX_TIME = 2147483647000;
var MIN_TIME = 0;
function parseDate(str, strict) {
  if (!str) {
    return ;
  }
  var found_time,
      found_dom,
      found_month,
      found_year;
  var tokens = str.split(DATE_DELIM);
  if (!tokens) {
    return ;
  }
  var date = new Date();
  date.setMilliseconds(0);
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i].trim();
    if (!token.length) {
      continue;
    }
    var result;
    if (!found_time) {
      result = (strict ? STRICT_TIME : TIME).exec(token);
      if (result) {
        found_time = true;
        date.setUTCHours(result[1]);
        date.setUTCMinutes(result[2]);
        date.setUTCSeconds(result[3]);
        continue;
      }
    }
    if (!found_dom) {
      result = DAY_OF_MONTH.exec(token);
      if (result) {
        found_dom = true;
        date.setUTCDate(result[1]);
        continue;
      }
    }
    if (!found_month) {
      result = MONTH.exec(token);
      if (result) {
        found_month = true;
        date.setUTCMonth(MONTH_TO_NUM[result[1].toLowerCase()]);
        continue;
      }
    }
    if (!found_year) {
      result = YEAR.exec(token);
      if (result) {
        var year = result[0];
        if (70 <= year && year <= 99) {
          year += 1900;
        } else if (0 <= year && year <= 69) {
          year += 2000;
        }
        if (year < 1601) {
          return ;
        }
        found_year = true;
        date.setUTCFullYear(year);
        continue;
      }
    }
  }
  if (!(found_time && found_dom && found_month && found_year)) {
    return ;
  }
  return date;
}
function formatDate(date) {
  var d = date.getUTCDate();
  d = d >= 10 ? d : '0' + d;
  var h = date.getUTCHours();
  h = h >= 10 ? h : '0' + h;
  var m = date.getUTCMinutes();
  m = m >= 10 ? m : '0' + m;
  var s = date.getUTCSeconds();
  s = s >= 10 ? s : '0' + s;
  return NUM_TO_DAY[date.getUTCDay()] + ', ' + d + ' ' + NUM_TO_MONTH[date.getUTCMonth()] + ' ' + date.getUTCFullYear() + ' ' + h + ':' + m + ':' + s + ' GMT';
}
function canonicalDomain(str) {
  if (str == null) {
    return null;
  }
  str = str.trim().replace(/^\./, '');
  if (punycode && /[^\u0001-\u007f]/.test(str)) {
    str = punycode.toASCII(str);
  }
  return str.toLowerCase();
}
function domainMatch(str, domStr, canonicalize) {
  if (str == null || domStr == null) {
    return null;
  }
  if (canonicalize !== false) {
    str = canonicalDomain(str);
    domStr = canonicalDomain(domStr);
  }
  if (str == domStr) {
    return true;
  }
  if (net.isIP(str)) {
    return false;
  }
  var idx = str.indexOf(domStr);
  if (idx <= 0) {
    return false;
  }
  if (str.length !== domStr.length + idx) {
    return false;
  }
  if (str.substr(idx - 1, 1) !== '.') {
    return false;
  }
  return true;
}
function defaultPath(path) {
  if (!path || path.substr(0, 1) !== "/") {
    return "/";
  }
  if (path === "/") {
    return path;
  }
  var rightSlash = path.lastIndexOf("/");
  if (rightSlash === 0) {
    return "/";
  }
  return path.slice(0, rightSlash);
}
function pathMatch(reqPath, cookiePath) {
  if (cookiePath === reqPath) {
    return true;
  }
  var idx = reqPath.indexOf(cookiePath);
  if (idx === 0) {
    if (cookiePath.substr(-1) === "/") {
      return true;
    }
    if (reqPath.substr(cookiePath.length, 1) === "/") {
      return true;
    }
  }
  return false;
}
function parse(str, strict) {
  str = str.trim();
  var semiColonCheck = TRAILING_SEMICOLON.exec(str);
  if (semiColonCheck) {
    if (strict) {
      return ;
    }
    str = str.slice(0, semiColonCheck.index);
  }
  var firstSemi = str.indexOf(';');
  var pairRx = strict ? COOKIE_PAIR_STRICT : COOKIE_PAIR;
  var result = pairRx.exec(firstSemi === -1 ? str : str.substr(0, firstSemi));
  if (!result) {
    return ;
  }
  var c = new Cookie();
  c.key = result[1];
  c.value = result[3];
  if (firstSemi === -1) {
    return c;
  }
  var unparsed = str.slice(firstSemi).replace(/^\s*;\s*/, '').trim();
  if (unparsed.length === 0) {
    return c;
  }
  var cookie_avs = unparsed.split(/\s*;\s*/);
  while (cookie_avs.length) {
    var av = cookie_avs.shift();
    if (strict && !EXTENSION_AV.test(av)) {
      return ;
    }
    var av_sep = av.indexOf('=');
    var av_key,
        av_value;
    if (av_sep === -1) {
      av_key = av;
      av_value = null;
    } else {
      av_key = av.substr(0, av_sep);
      av_value = av.substr(av_sep + 1);
    }
    av_key = av_key.trim().toLowerCase();
    if (av_value) {
      av_value = av_value.trim();
    }
    switch (av_key) {
      case 'expires':
        if (!av_value) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        var exp = parseDate(av_value, strict);
        if (exp == null) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        c.expires = exp;
        break;
      case 'max-age':
        if (!av_value) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        if (!/^-?[0-9]+$/.test(av_value)) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        var delta = parseInt(av_value, 10);
        if (strict && delta <= 0) {
          return ;
        }
        c.setMaxAge(delta);
        break;
      case 'domain':
        if (!av_value) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        var domain = av_value.trim().replace(/^\./, '');
        if (!domain) {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        c.domain = domain.toLowerCase();
        break;
      case 'path':
        if (!av_value || av_value.substr(0, 1) != "/") {
          if (strict) {
            return ;
          } else {
            break;
          }
        }
        c.path = av_value;
        break;
      case 'secure':
        if (av_value != null) {
          if (strict) {
            return ;
          }
        }
        c.secure = true;
        break;
      case 'httponly':
        if (av_value != null) {
          if (strict) {
            return ;
          }
        }
        c.httpOnly = true;
        break;
      default:
        c.extensions = c.extensions || [];
        c.extensions.push(av);
        break;
    }
  }
  c.creation = new Date();
  return c;
}
function fromJSON(str) {
  if (!str) {
    return null;
  }
  var obj;
  try {
    obj = JSON.parse(str);
  } catch (e) {
    return null;
  }
  var c = new Cookie();
  for (var i = 0; i < numCookieProperties; i++) {
    var prop = cookieProperties[i];
    if (obj[prop] == null) {
      continue;
    }
    if (prop === 'expires' || prop === 'creation' || prop === 'lastAccessed') {
      c[prop] = obj[prop] == "Infinity" ? "Infinity" : new Date(obj[prop]);
    } else {
      c[prop] = obj[prop];
    }
  }
  c.creation = c.creation || new Date();
  return c;
}
function cookieCompare(a, b) {
  var deltaLen = (b.path ? b.path.length : 0) - (a.path ? a.path.length : 0);
  if (deltaLen !== 0) {
    return deltaLen;
  }
  return (a.creation ? a.creation.getTime() : MAX_TIME) - (b.creation ? b.creation.getTime() : MAX_TIME);
}
function permuteDomain(domain) {
  var pubSuf = pubsuffix.getPublicSuffix(domain);
  if (!pubSuf) {
    return null;
  }
  if (pubSuf == domain) {
    return [domain];
  }
  var prefix = domain.slice(0, -(pubSuf.length + 1));
  var parts = prefix.split('.').reverse();
  var cur = pubSuf;
  var permutations = [cur];
  while (parts.length) {
    cur = parts.shift() + '.' + cur;
    permutations.push(cur);
  }
  return permutations;
}
function permutePath(path) {
  if (path === '/') {
    return ['/'];
  }
  if (path.lastIndexOf('/') === path.length - 1) {
    path = path.substr(0, path.length - 1);
  }
  var permutations = [path];
  while (path.length > 1) {
    var lindex = path.lastIndexOf('/');
    if (lindex === 0) {
      break;
    }
    path = path.substr(0, lindex);
    permutations.push(path);
  }
  permutations.push('/');
  return permutations;
}
function Cookie(opts) {
  if (typeof opts !== "object") {
    return ;
  }
  Object.keys(opts).forEach(function(key) {
    if (Cookie.prototype.hasOwnProperty(key)) {
      this[key] = opts[key] || Cookie.prototype[key];
    }
  }.bind(this));
}
Cookie.parse = parse;
Cookie.fromJSON = fromJSON;
Cookie.prototype.key = "";
Cookie.prototype.value = "";
Cookie.prototype.expires = "Infinity";
Cookie.prototype.maxAge = null;
Cookie.prototype.domain = null;
Cookie.prototype.path = null;
Cookie.prototype.secure = false;
Cookie.prototype.httpOnly = false;
Cookie.prototype.extensions = null;
Cookie.prototype.hostOnly = null;
Cookie.prototype.pathIsDefault = null;
Cookie.prototype.creation = null;
Cookie.prototype.lastAccessed = null;
var cookieProperties = Object.freeze(Object.keys(Cookie.prototype).map(function(p) {
  if (p instanceof Function) {
    return ;
  }
  return p;
}));
var numCookieProperties = cookieProperties.length;
Cookie.prototype.inspect = function inspect() {
  var now = Date.now();
  return 'Cookie="' + this.toString() + '; hostOnly=' + (this.hostOnly != null ? this.hostOnly : '?') + '; aAge=' + (this.lastAccessed ? (now - this.lastAccessed.getTime()) + 'ms' : '?') + '; cAge=' + (this.creation ? (now - this.creation.getTime()) + 'ms' : '?') + '"';
};
Cookie.prototype.validate = function validate() {
  if (!COOKIE_OCTETS.test(this.value)) {
    return false;
  }
  if (this.expires != Infinity && !(this.expires instanceof Date) && !parseDate(this.expires, true)) {
    return false;
  }
  if (this.maxAge != null && this.maxAge <= 0) {
    return false;
  }
  if (this.path != null && !PATH_VALUE.test(this.path)) {
    return false;
  }
  var cdomain = this.cdomain();
  if (cdomain) {
    if (cdomain.match(/\.$/)) {
      return false;
    }
    var suffix = pubsuffix.getPublicSuffix(cdomain);
    if (suffix == null) {
      return false;
    }
  }
  return true;
};
Cookie.prototype.setExpires = function setExpires(exp) {
  if (exp instanceof Date) {
    this.expires = exp;
  } else {
    this.expires = parseDate(exp) || "Infinity";
  }
};
Cookie.prototype.setMaxAge = function setMaxAge(age) {
  if (age === Infinity || age === -Infinity) {
    this.maxAge = age.toString();
  } else {
    this.maxAge = age;
  }
};
Cookie.prototype.cookieString = function cookieString() {
  var val = this.value;
  if (val == null) {
    val = '';
  }
  return this.key + '=' + val;
};
Cookie.prototype.toString = function toString() {
  var str = this.cookieString();
  if (this.expires != Infinity) {
    if (this.expires instanceof Date) {
      str += '; Expires=' + formatDate(this.expires);
    } else {
      str += '; Expires=' + this.expires;
    }
  }
  if (this.maxAge != null && this.maxAge != Infinity) {
    str += '; Max-Age=' + this.maxAge;
  }
  if (this.domain && !this.hostOnly) {
    str += '; Domain=' + this.domain;
  }
  if (this.path) {
    str += '; Path=' + this.path;
  }
  if (this.secure) {
    str += '; Secure';
  }
  if (this.httpOnly) {
    str += '; HttpOnly';
  }
  if (this.extensions) {
    this.extensions.forEach(function(ext) {
      str += '; ' + ext;
    });
  }
  return str;
};
Cookie.prototype.TTL = function TTL(now) {
  if (this.maxAge != null) {
    return this.maxAge <= 0 ? 0 : this.maxAge * 1000;
  }
  var expires = this.expires;
  if (expires != Infinity) {
    if (!(expires instanceof Date)) {
      expires = parseDate(expires) || Infinity;
    }
    if (expires == Infinity) {
      return Infinity;
    }
    return expires.getTime() - (now || Date.now());
  }
  return Infinity;
};
Cookie.prototype.expiryTime = function expiryTime(now) {
  if (this.maxAge != null) {
    var relativeTo = this.creation || now || new Date();
    var age = (this.maxAge <= 0) ? -Infinity : this.maxAge * 1000;
    return relativeTo.getTime() + age;
  }
  if (this.expires == Infinity) {
    return Infinity;
  }
  return this.expires.getTime();
};
Cookie.prototype.expiryDate = function expiryDate(now) {
  var millisec = this.expiryTime(now);
  if (millisec == Infinity) {
    return new Date(MAX_TIME);
  } else if (millisec == -Infinity) {
    return new Date(MIN_TIME);
  } else {
    return new Date(millisec);
  }
};
Cookie.prototype.isPersistent = function isPersistent() {
  return (this.maxAge != null || this.expires != Infinity);
};
Cookie.prototype.cdomain = Cookie.prototype.canonicalizedDomain = function canonicalizedDomain() {
  if (this.domain == null) {
    return null;
  }
  return canonicalDomain(this.domain);
};
var memstore;
function CookieJar(store, rejectPublicSuffixes) {
  if (rejectPublicSuffixes != null) {
    this.rejectPublicSuffixes = rejectPublicSuffixes;
  }
  if (!store) {
    memstore = memstore || require("./memstore");
    store = new memstore.MemoryCookieStore();
  }
  this.store = store;
}
CookieJar.prototype.store = null;
CookieJar.prototype.rejectPublicSuffixes = true;
var CAN_BE_SYNC = [];
CAN_BE_SYNC.push('setCookie');
CookieJar.prototype.setCookie = function(cookie, url, options, cb) {
  var err;
  var context = (url instanceof Object) ? url : urlParse(url);
  if (options instanceof Function) {
    cb = options;
    options = {};
  }
  var host = canonicalDomain(context.hostname);
  if (!(cookie instanceof Cookie)) {
    cookie = Cookie.parse(cookie, options.strict === true);
  }
  if (!cookie) {
    err = new Error("Cookie failed to parse");
    return cb(options.ignoreError ? null : err);
  }
  var now = options.now || new Date();
  if (this.rejectPublicSuffixes && cookie.domain) {
    var suffix = pubsuffix.getPublicSuffix(cookie.cdomain());
    if (suffix == null) {
      err = new Error("Cookie has domain set to a public suffix");
      return cb(options.ignoreError ? null : err);
    }
  }
  if (cookie.domain) {
    if (!domainMatch(host, cookie.cdomain(), false)) {
      err = new Error("Cookie not in this host's domain. Cookie:" + cookie.cdomain() + " Request:" + host);
      return cb(options.ignoreError ? null : err);
    }
    if (cookie.hostOnly == null) {
      cookie.hostOnly = false;
    }
  } else {
    cookie.hostOnly = true;
    cookie.domain = host;
  }
  if (!cookie.path) {
    cookie.path = defaultPath(context.pathname);
    cookie.pathIsDefault = true;
  } else {
    if (cookie.path.length > 1 && cookie.path.substr(-1) == '/') {
      cookie.path = cookie.path.slice(0, -1);
    }
  }
  if (options.http === false && cookie.httpOnly) {
    err = new Error("Cookie is HttpOnly and this isn't an HTTP API");
    return cb(options.ignoreError ? null : err);
  }
  var store = this.store;
  if (!store.updateCookie) {
    store.updateCookie = function(oldCookie, newCookie, cb) {
      this.putCookie(newCookie, cb);
    };
  }
  function withCookie(err, oldCookie) {
    if (err) {
      return cb(err);
    }
    var next = function(err) {
      if (err) {
        return cb(err);
      } else {
        cb(null, cookie);
      }
    };
    if (oldCookie) {
      if (options.http === false && oldCookie.httpOnly) {
        err = new Error("old Cookie is HttpOnly and this isn't an HTTP API");
        return cb(options.ignoreError ? null : err);
      }
      cookie.creation = oldCookie.creation;
      cookie.lastAccessed = now;
      store.updateCookie(oldCookie, cookie, next);
    } else {
      cookie.creation = cookie.lastAccessed = now;
      store.putCookie(cookie, next);
    }
  }
  store.findCookie(cookie.domain, cookie.path, cookie.key, withCookie);
};
CAN_BE_SYNC.push('getCookies');
CookieJar.prototype.getCookies = function(url, options, cb) {
  var context = (url instanceof Object) ? url : urlParse(url);
  if (options instanceof Function) {
    cb = options;
    options = {};
  }
  var host = canonicalDomain(context.hostname);
  var path = context.pathname || '/';
  var secure = options.secure;
  if (secure == null && context.protocol && (context.protocol == 'https:' || context.protocol == 'wss:')) {
    secure = true;
  }
  var http = options.http;
  if (http == null) {
    http = true;
  }
  var now = options.now || Date.now();
  var expireCheck = options.expire !== false;
  var allPaths = !!options.allPaths;
  var store = this.store;
  function matchingCookie(c) {
    if (c.hostOnly) {
      if (c.domain != host) {
        return false;
      }
    } else {
      if (!domainMatch(host, c.domain, false)) {
        return false;
      }
    }
    if (!allPaths && !pathMatch(path, c.path)) {
      return false;
    }
    if (c.secure && !secure) {
      return false;
    }
    if (c.httpOnly && !http) {
      return false;
    }
    if (expireCheck && c.expiryTime() <= now) {
      store.removeCookie(c.domain, c.path, c.key, function() {});
      return false;
    }
    return true;
  }
  store.findCookies(host, allPaths ? null : path, function(err, cookies) {
    if (err) {
      return cb(err);
    }
    cookies = cookies.filter(matchingCookie);
    if (options.sort !== false) {
      cookies = cookies.sort(cookieCompare);
    }
    var now = new Date();
    cookies.forEach(function(c) {
      c.lastAccessed = now;
    });
    cb(null, cookies);
  });
};
CAN_BE_SYNC.push('getCookieString');
CookieJar.prototype.getCookieString = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  var cb = args.pop();
  var next = function(err, cookies) {
    if (err) {
      cb(err);
    } else {
      cb(null, cookies.map(function(c) {
        return c.cookieString();
      }).join('; '));
    }
  };
  args.push(next);
  this.getCookies.apply(this, args);
};
CAN_BE_SYNC.push('getSetCookieStrings');
CookieJar.prototype.getSetCookieStrings = function() {
  var args = Array.prototype.slice.call(arguments, 0);
  var cb = args.pop();
  var next = function(err, cookies) {
    if (err) {
      cb(err);
    } else {
      cb(null, cookies.map(function(c) {
        return c.toString();
      }));
    }
  };
  args.push(next);
  this.getCookies.apply(this, args);
};
function syncWrap(method) {
  return function() {
    if (!this.store.synchronous) {
      throw new Error('CookieJar store is not synchronous; use async API instead.');
    }
    var args = Array.prototype.slice.call(arguments);
    var syncErr,
        syncResult;
    args.push(function syncCb(err, result) {
      syncErr = err;
      syncResult = result;
    });
    this[method].apply(this, args);
    if (syncErr) {
      throw syncErr;
    }
    return syncResult;
  };
}
CAN_BE_SYNC.forEach(function(method) {
  CookieJar.prototype[method + 'Sync'] = syncWrap(method);
});
module.exports = {
  CookieJar: CookieJar,
  Cookie: Cookie,
  Store: Store,
  parseDate: parseDate,
  formatDate: formatDate,
  parse: parse,
  fromJSON: fromJSON,
  domainMatch: domainMatch,
  defaultPath: defaultPath,
  pathMatch: pathMatch,
  getPublicSuffix: pubsuffix.getPublicSuffix,
  cookieCompare: cookieCompare,
  permuteDomain: permuteDomain,
  permutePath: permutePath,
  canonicalDomain: canonicalDomain
};
