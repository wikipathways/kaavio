/* */ 
'use strict';
var pako = require("../../../index");
exports.run = function(data, level) {
  return pako.deflate(data.typed, {level: level});
};
