/* */ 
var url = require("url");
var CookieJar = exports = module.exports = function CookieJar() {
  this.cookies = [];
};
CookieJar.prototype.add = function(cookie) {
  this.cookies = this.cookies.filter(function(c) {
    return !(c.name == cookie.name && c.path == cookie.path);
  });
  this.cookies.push(cookie);
};
CookieJar.prototype.get = function(req) {
  var path = url.parse(req.url).pathname,
      now = new Date,
      specificity = {};
  return this.cookies.filter(function(cookie) {
    if (0 == path.indexOf(cookie.path) && now < cookie.expires && cookie.path.length > (specificity[cookie.name] || 0))
      return specificity[cookie.name] = cookie.path.length;
  });
};
CookieJar.prototype.cookieString = function(req) {
  var cookies = this.get(req);
  if (cookies.length) {
    return cookies.map(function(cookie) {
      return cookie.name + '=' + cookie.value;
    }).join('; ');
  }
};
