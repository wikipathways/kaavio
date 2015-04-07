/* */ 
var Utils = require("./utilities"),
    _browser = 'unknown';
;
if (false || !!document.documentMode) {
  _browser = 'ie';
}
module.exports = {
  svgNS: 'http://www.w3.org/2000/svg',
  xmlNS: 'http://www.w3.org/XML/1998/namespace',
  xmlnsNS: 'http://www.w3.org/2000/xmlns/',
  xlinkNS: 'http://www.w3.org/1999/xlink',
  evNS: 'http://www.w3.org/2001/xml-events',
  getBoundingClientRectNormalized: function(svg) {
    if (svg.clientWidth && svg.clientHeight) {
      return {
        width: svg.clientWidth,
        height: svg.clientHeight
      };
    } else if (!!svg.getBoundingClientRect()) {
      return svg.getBoundingClientRect();
    } else {
      throw new Error('Cannot get BoundingClientRect for SVG.');
    }
  },
  getOrCreateViewport: function(svg, selector) {
    var viewport = null;
    if (Utils.isElement(selector)) {
      viewport = selector;
    } else {
      viewport = svg.querySelector(selector);
    }
    if (!viewport) {
      var childNodes = Array.prototype.slice.call(svg.childNodes || svg.children).filter(function(el) {
        return el.nodeName !== 'defs' && el.nodeName !== '#text';
      });
      if (childNodes.length === 1 && childNodes[0].nodeName === 'g' && childNodes[0].getAttribute('transform') === null) {
        viewport = childNodes[0];
      }
    }
    if (!viewport) {
      var viewportId = 'viewport-' + new Date().toISOString().replace(/\D/g, '');
      viewport = document.createElementNS(this.svgNS, 'g');
      viewport.setAttribute('id', viewportId);
      var svgChildren = svg.childNodes || svg.children;
      if (!!svgChildren && svgChildren.length > 0) {
        for (var i = svgChildren.length; i > 0; i--) {
          if (svgChildren[svgChildren.length - i].nodeName !== 'defs') {
            viewport.appendChild(svgChildren[svgChildren.length - i]);
          }
        }
      }
      svg.appendChild(viewport);
    }
    var classNames = [];
    if (viewport.getAttribute('class')) {
      classNames = viewport.getAttribute('class').split(' ');
    }
    if (!~classNames.indexOf('svg-pan-zoom_viewport')) {
      classNames.push('svg-pan-zoom_viewport');
      viewport.setAttribute('class', classNames.join(' '));
    }
    return viewport;
  },
  setupSvgAttributes: function(svg) {
    svg.setAttribute('xmlns', this.svgNS);
    svg.setAttributeNS(this.xmlnsNS, 'xmlns:xlink', this.xlinkNS);
    svg.setAttributeNS(this.xmlnsNS, 'xmlns:ev', this.evNS);
    if (svg.parentNode !== null) {
      var style = svg.getAttribute('style') || '';
      if (style.toLowerCase().indexOf('overflow') === -1) {
        svg.setAttribute('style', 'overflow: hidden; ' + style);
      }
    }
  },
  internetExplorerRedisplayInterval: 300,
  refreshDefsGlobal: Utils.throttle(function() {
    var allDefs = document.querySelectorAll('defs');
    var allDefsCount = allDefs.length;
    for (var i = 0; i < allDefsCount; i++) {
      var thisDefs = allDefs[i];
      thisDefs.parentNode.insertBefore(thisDefs, thisDefs);
    }
  }, this.internetExplorerRedisplayInterval),
  setCTM: function(element, matrix, defs) {
    var that = this,
        s = 'matrix(' + matrix.a + ',' + matrix.b + ',' + matrix.c + ',' + matrix.d + ',' + matrix.e + ',' + matrix.f + ')';
    element.setAttributeNS(null, 'transform', s);
    if (_browser === 'ie' && !!defs) {
      defs.parentNode.insertBefore(defs, defs);
      window.setTimeout(function() {
        that.refreshDefsGlobal();
      }, that.internetExplorerRedisplayInterval);
    }
  },
  getEventPoint: function(evt, svg) {
    var point = svg.createSVGPoint();
    Utils.mouseAndTouchNormalize(evt, svg);
    point.x = evt.clientX;
    point.y = evt.clientY;
    return point;
  },
  getSvgCenterPoint: function(svg, width, height) {
    return this.createSVGPoint(svg, width / 2, height / 2);
  },
  createSVGPoint: function(svg, x, y) {
    var point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    return point;
  }
};
