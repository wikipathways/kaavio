/* */ 
var isError = require("../lang/isError");
function attempt() {
  var func = arguments[0],
      length = arguments.length,
      args = Array(length ? (length - 1) : 0);
  while (--length > 0) {
    args[length - 1] = arguments[length];
  }
  try {
    return func.apply(undefined, args);
  } catch (e) {
    return isError(e) ? e : new Error(e);
  }
}
module.exports = attempt;
