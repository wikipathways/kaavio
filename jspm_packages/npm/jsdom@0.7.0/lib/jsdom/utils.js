/* */ 
(function(process) {
  var path = require("path");
  exports.intercept = function(clazz, method, interceptor) {
    var proto = clazz.prototype,
        _super = proto[method],
        unwrapArgs = interceptor.length > 2;
    proto[method] = function() {
      if (unwrapArgs) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(_super, arguments);
        return interceptor.apply(this, args);
      } else {
        return interceptor.call(this, _super, arguments);
      }
    };
  };
  exports.toFileUrl = function(fileName) {
    var pathname = path.resolve(process.cwd(), fileName).replace(/\\/g, '/');
    if (pathname[0] !== '/') {
      pathname = '/' + pathname;
    }
    return 'file://' + pathname;
  };
})(require("process"));
