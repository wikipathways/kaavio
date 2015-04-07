/* */ 
'use strict';
var pako = require("../../../index");
var utils = require("../../../lib/utils/common");
exports.run = function(data, level) {
  utils.setTyped(false);
  pako.inflate(data.deflateTyped, {});
  utils.setTyped(true);
};
