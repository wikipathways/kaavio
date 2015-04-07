/* */ 
'use strict';
var deflateSync = require("./node-zlib").deflateSync;
exports.run = function(data, level) {
  return deflateSync(data.typed, {level: level});
};
