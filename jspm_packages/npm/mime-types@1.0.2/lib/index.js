/* */ 
"format cjs";
exports.types = Object.create(null);
exports.extensions = Object.create(null);
exports.define = define;
exports.json = {
  mime: require("./mime.json!systemjs-json"),
  node: require("./node.json!systemjs-json"),
  custom: require("./custom.json!systemjs-json")
};
exports.lookup = function(string) {
  if (!string || typeof string !== "string")
    return false;
  string = string.replace(/.*[\.\/\\]/, '').toLowerCase();
  if (!string)
    return false;
  return exports.types[string] || false;
};
exports.extension = function(type) {
  if (!type || typeof type !== "string")
    return false;
  type = type.match(/^\s*([^;\s]*)(?:;|\s|$)/);
  if (!type)
    return false;
  var exts = exports.extensions[type[1].toLowerCase()];
  if (!exts || !exts.length)
    return false;
  return exts[0];
};
exports.charset = function(type) {
  switch (type) {
    case 'application/json':
      return 'UTF-8';
    case 'application/javascript':
      return 'UTF-8';
  }
  if (/^text\//.test(type))
    return 'UTF-8';
  return false;
};
exports.charsets = {lookup: exports.charset};
exports.contentType = function(type) {
  if (!type || typeof type !== "string")
    return false;
  if (!~type.indexOf('/'))
    type = exports.lookup(type);
  if (!type)
    return false;
  if (!~type.indexOf('charset')) {
    var charset = exports.charset(type);
    if (charset)
      type += '; charset=' + charset.toLowerCase();
  }
  return type;
};
define(exports.json.mime);
define(exports.json.node);
define(exports.json.custom);
function define(json) {
  Object.keys(json).forEach(function(type) {
    var exts = json[type] || [];
    exports.extensions[type] = exports.extensions[type] || [];
    exts.forEach(function(ext) {
      if (!~exports.extensions[type].indexOf(ext))
        exports.extensions[type].push(ext);
      exports.types[ext] = type;
    });
  });
}
