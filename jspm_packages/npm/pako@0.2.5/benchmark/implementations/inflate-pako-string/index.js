/* */ 
'use strict';
var pako = require("../../../index");
exports.run = function(data) {
  return pako.inflate(data.deflateString, {to: 'string'});
};
