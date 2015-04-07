/* */ 
'use strict';
var pako = require("../../../index");
var utils = require("../../../lib/utils/common");
exports.run = function(data, level) {
  utils.setTyped(false);
  pako.deflate(data.typed, {level: level});
  utils.setTyped(true);
};
