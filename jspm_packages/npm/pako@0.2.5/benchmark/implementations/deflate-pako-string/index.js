/* */ 
'use strict';
var pako = require("../../../index");
var utils = require("../../../lib/utils/common");
exports.run = function(data, level) {
  pako.deflate(data.string, {
    level: level,
    to: 'string'
  });
};
