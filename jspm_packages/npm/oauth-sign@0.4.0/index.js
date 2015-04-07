/* */ 
var crypto = require("crypto"),
    qs = require("querystring");
;
function sha1(key, body) {
  return crypto.createHmac('sha1', key).update(body).digest('base64');
}
function rfc3986(str) {
  return encodeURIComponent(str).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27');
  ;
}
function map(obj) {
  var key,
      val,
      arr = [];
  for (key in obj) {
    val = obj[key];
    if (Array.isArray(val))
      for (var i = 0; i < val.length; i++)
        arr.push([key, val[i]]);
    else
      arr.push([key, val]);
  }
  return arr;
}
function compare(a, b) {
  return a > b ? 1 : a < b ? -1 : 0;
}
function hmacsign(httpMethod, base_uri, params, consumer_secret, token_secret) {
  var normalized = map(params).map(function(p) {
    return [rfc3986(p[0]), rfc3986(p[1] || '')];
  }).sort(function(a, b) {
    return compare(a[0], b[0]) || compare(a[1], b[1]);
  }).map(function(p) {
    return p.join('=');
  }).join('&');
  var base = [rfc3986(httpMethod ? httpMethod.toUpperCase() : 'GET'), rfc3986(base_uri), rfc3986(normalized)].join('&');
  var key = [consumer_secret || '', token_secret || ''].map(rfc3986).join('&');
  return sha1(key, base);
}
exports.hmacsign = hmacsign;
exports.rfc3986 = rfc3986;
