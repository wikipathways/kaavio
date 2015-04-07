/* */ 
var DOMParser = require("../../dom-parser").DOMParser;
require("./mock");
{
  var doc = new DOMParser().parseFromString("<xml/>", 'text/xml');
  var np = doc.__proto__.__proto__.__proto__;
  for (var n in np) {
    if (/_NODE$/.test(n)) {
      np[n.replace(/_NODE$/, '')] = np[n];
    }
  }
}
require.cache[require.resolve('node-o3-xml')] = require.cache[require.resolve('./mock')];
require("node-o3-xml").parseFromString = function(xml) {
  return new DOMParser().parseFromString(xml, 'text/xml');
};
require("node-o3-xml/test/test");
