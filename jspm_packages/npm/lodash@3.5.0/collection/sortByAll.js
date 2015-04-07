/* */ 
var baseFlatten = require("../internal/baseFlatten"),
    baseSortByOrder = require("../internal/baseSortByOrder"),
    isIterateeCall = require("../internal/isIterateeCall");
function sortByAll(collection) {
  if (collection == null) {
    return [];
  }
  var args = arguments,
      guard = args[3];
  if (guard && isIterateeCall(args[1], args[2], guard)) {
    args = [collection, args[1]];
  }
  return baseSortByOrder(collection, baseFlatten(args, false, false, 1), []);
}
module.exports = sortByAll;
