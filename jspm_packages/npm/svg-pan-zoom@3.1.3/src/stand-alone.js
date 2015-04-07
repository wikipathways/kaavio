/* */ 
"format cjs";
var svgPanZoom = require("./svg-pan-zoom");
(function(window, document) {
  if (typeof define === 'function' && define.amd) {
    define('svg-pan-zoom', function() {
      return svgPanZoom;
    });
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = svgPanZoom;
    window.svgPanZoom = svgPanZoom;
  }
})(window, document);
