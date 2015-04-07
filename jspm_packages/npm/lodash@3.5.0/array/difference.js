/* */ 
var baseDifference = require("../internal/baseDifference"),
    baseFlatten = require("../internal/baseFlatten"),
    isArguments = require("../lang/isArguments"),
    isArray = require("../lang/isArray");
function difference() {
  var args = arguments,
      index = -1,
      length = args.length;
  while (++index < length) {
    var value = args[index];
    if (isArray(value) || isArguments(value)) {
      break;
    }
  }
  return baseDifference(value, baseFlatten(args, false, true, ++index));
}
module.exports = difference;
