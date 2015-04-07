/* */ 
'use strict';
var fs = require("fs");
var traceur = require("./traceur");
var path = require("path");
var nodeLoader = require("./nodeLoader");
var url = (path.resolve('./') + '/').replace(/\\/g, '/');
var LoaderCompiler = traceur.runtime.LoaderCompiler;
var NodeLoaderCompiler = function() {
  LoaderCompiler.call(this);
};
NodeLoaderCompiler.prototype = {
  __proto__: LoaderCompiler.prototype,
  evaluateCodeUnit: function(codeUnit) {
    var result = module._compile(codeUnit.metadata.transcoded, codeUnit.address || codeUnit.normalizedName);
    codeUnit.metadata.transformedTree = null;
    return result;
  }
};
var System = new traceur.runtime.TraceurLoader(nodeLoader, url, new NodeLoaderCompiler());
require("source-map-support").install({retrieveSourceMap: function(filename) {
    var map = System.getSourceMap(filename);
    if (map) {
      return {
        url: filename,
        map: map
      };
    }
  }});
Reflect.global.System = System;
System.map = System.semverMap(System.version);
module.exports = System;
