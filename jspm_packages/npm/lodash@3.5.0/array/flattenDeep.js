/* */ 
var baseFlatten = require("../internal/baseFlatten");
function flattenDeep(array) {
  var length = array ? array.length : 0;
  return length ? baseFlatten(array, true, false, 0) : [];
}
module.exports = flattenDeep;
