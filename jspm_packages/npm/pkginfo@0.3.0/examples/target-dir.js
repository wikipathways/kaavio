/* */ 
var util = require("util"),
    path = require("path"),
    pkginfo = require("../lib/pkginfo")(module, {dir: path.resolve(__dirname, 'subdir')});
exports.someFunction = function() {
  console.log('some of your custom logic here');
};
console.log('Inspecting module:');
console.dir(module.exports);
console.log('\nAll exports exposed:');
console.error(Object.keys(module.exports));
