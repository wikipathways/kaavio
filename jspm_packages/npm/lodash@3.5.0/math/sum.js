/* */ 
var isArray = require("../lang/isArray"),
    toIterable = require("../internal/toIterable");
function sum(collection) {
  if (!isArray(collection)) {
    collection = toIterable(collection);
  }
  var length = collection.length,
      result = 0;
  while (length--) {
    result += +collection[length] || 0;
  }
  return result;
}
module.exports = sum;
