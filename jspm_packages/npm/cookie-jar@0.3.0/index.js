/* */ 
var url = require("url");
var Cookie = exports = module.exports = function Cookie(str, req) {
  this.str = str;
  str.split(/ *; */).reduce(function(obj, pair) {
    var p = pair.indexOf('=');
    var key = p > 0 ? pair.substring(0, p).trim() : pair.trim();
    var lowerCasedKey = key.toLowerCase();
    var value = p > 0 ? pair.substring(p + 1).trim() : true;
    if (!obj.name) {
      obj.name = key;
      obj.value = value;
    } else if (lowerCasedKey === 'httponly') {
      obj.httpOnly = value;
    } else {
      obj[lowerCasedKey] = value;
    }
    return obj;
  }, this);
  this.expires = this.expires ? new Date(this.expires) : Infinity;
  this.path = this.path ? this.path.trim() : req ? url.parse(req.url).pathname : '/';
};
Cookie.prototype.toString = function() {
  return this.str;
};
module.exports.Jar = require("./jar");
