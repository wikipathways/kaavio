/* */ 
'use strict';
var inflateSync = require("./node-zlib").inflateSync;
exports.run = function(data, level) {
  return inflateSync(data.deflateTyped);
};
