/* */ 
var SvgUtils = require("./svg-utilities"),
    Utils = require("./utilities");
;
var ShadowViewport = function(viewport, options) {
  this.init(viewport, options);
};
ShadowViewport.prototype.init = function(viewport, options) {
  this.viewport = viewport;
  this.options = options;
  this.originalState = {
    zoom: 1,
    x: 0,
    y: 0
  };
  this.activeState = {
    zoom: 1,
    x: 0,
    y: 0
  };
  this.updateCTMCached = Utils.proxy(this.updateCTM, this);
  this.requestAnimationFrame = Utils.createRequestAnimationFrame(this.options.refreshRate);
  this.viewBox = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
  };
  this.cacheViewBox();
  this.processCTM();
};
ShadowViewport.prototype.cacheViewBox = function() {
  var svgViewBox = this.options.svg.getAttribute('viewBox');
  if (svgViewBox) {
    var viewBoxValues = svgViewBox.split(' ').map(parseFloat);
    this.viewBox.x = viewBoxValues[0];
    this.viewBox.y = viewBoxValues[1];
    this.viewBox.width = viewBoxValues[2];
    this.viewBox.height = viewBoxValues[3];
    var zoom = Math.min(this.options.width / this.viewBox.width, this.options.height / this.viewBox.height);
    this.activeState.zoom = zoom;
    this.activeState.x = (this.options.width - this.viewBox.width * zoom) / 2;
    this.activeState.y = (this.options.height - this.viewBox.height * zoom) / 2;
    this.updateCTMOnNextFrame();
    this.options.svg.removeAttribute('viewBox');
  } else {
    var bBox = this.viewport.getBBox();
    this.viewBox.x = bBox.x;
    this.viewBox.y = bBox.y;
    this.viewBox.width = bBox.width;
    this.viewBox.height = bBox.height;
  }
};
ShadowViewport.prototype.recacheViewBox = function() {
  var boundingClientRect = this.viewport.getBoundingClientRect(),
      viewBoxWidth = boundingClientRect.width / this.getZoom(),
      viewBoxHeight = boundingClientRect.height / this.getZoom();
  this.viewBox.x = 0;
  this.viewBox.y = 0;
  this.viewBox.width = viewBoxWidth;
  this.viewBox.height = viewBoxHeight;
};
ShadowViewport.prototype.getViewBox = function() {
  return Utils.extend({}, this.viewBox);
};
ShadowViewport.prototype.processCTM = function() {
  var newCTM = this.getCTM();
  if (this.options.fit) {
    var newScale = Math.min(this.options.width / (this.viewBox.width - this.viewBox.x), this.options.height / (this.viewBox.height - this.viewBox.y));
    newCTM.a = newScale;
    newCTM.d = newScale;
    newCTM.e = -this.viewBox.x * newScale;
    newCTM.f = -this.viewBox.y * newScale;
  }
  if (this.options.center) {
    var offsetX = (this.options.width - (this.viewBox.width + this.viewBox.x) * newCTM.a) * 0.5,
        offsetY = (this.options.height - (this.viewBox.height + this.viewBox.y) * newCTM.a) * 0.5;
    newCTM.e = offsetX;
    newCTM.f = offsetY;
  }
  this.originalState.zoom = newCTM.a;
  this.originalState.x = newCTM.e;
  this.originalState.y = newCTM.f;
  this.setCTM(newCTM);
};
ShadowViewport.prototype.getOriginalState = function() {
  return Utils.extend({}, this.originalState);
};
ShadowViewport.prototype.getState = function() {
  return Utils.extend({}, this.activeState);
};
ShadowViewport.prototype.getZoom = function() {
  return this.activeState.zoom;
};
ShadowViewport.prototype.getRelativeZoom = function() {
  return this.activeState.zoom / this.originalState.zoom;
};
ShadowViewport.prototype.computeRelativeZoom = function(scale) {
  return scale / this.originalState.zoom;
};
ShadowViewport.prototype.getPan = function() {
  return {
    x: this.activeState.x,
    y: this.activeState.y
  };
};
ShadowViewport.prototype.getCTM = function() {
  var safeCTM = this.options.svg.createSVGMatrix();
  safeCTM.a = this.activeState.zoom;
  safeCTM.b = 0;
  safeCTM.c = 0;
  safeCTM.d = this.activeState.zoom;
  safeCTM.e = this.activeState.x;
  safeCTM.f = this.activeState.y;
  return safeCTM;
};
ShadowViewport.prototype.setCTM = function(newCTM) {
  var willZoom = this.isZoomDifferent(newCTM),
      willPan = this.isPanDifferent(newCTM);
  if (willZoom || willPan) {
    if (willZoom) {
      if (this.options.beforeZoom(this.getRelativeZoom(), this.computeRelativeZoom(newCTM.a)) === false) {
        newCTM.a = newCTM.d = this.activeState.zoom;
        willZoom = false;
      }
    }
    if (willPan) {
      var preventPan = this.options.beforePan(this.getPan(), {
        x: newCTM.e,
        y: newCTM.f
      }),
          preventPanX = false,
          preventPanY = false;
      if (preventPan === false) {
        newCTM.e = this.getPan().x;
        newCTM.f = this.getPan().y;
        preventPanX = preventPanY = true;
      } else if (Utils.isObject(preventPan)) {
        if (preventPan.x === false) {
          newCTM.e = this.getPan().x;
          preventPanX = true;
        } else if (Utils.isNumber(preventPan.x)) {
          newCTM.e = preventPan.x;
        }
        if (preventPan.y === false) {
          newCTM.f = this.getPan().y;
          preventPanY = true;
        } else if (Utils.isNumber(preventPan.y)) {
          newCTM.f = preventPan.y;
        }
      }
      if (preventPanX && preventPanY) {
        willPan = false;
      }
    }
    if (willZoom || willPan) {
      this.updateCache(newCTM);
      this.updateCTMOnNextFrame();
      if (willZoom) {
        this.options.onZoom(this.getRelativeZoom());
      }
      if (willPan) {
        this.options.onPan(this.getPan());
      }
    }
  }
};
ShadowViewport.prototype.isZoomDifferent = function(newCTM) {
  return this.activeState.zoom !== newCTM.a;
};
ShadowViewport.prototype.isPanDifferent = function(newCTM) {
  return this.activeState.x !== newCTM.e || this.activeState.y !== newCTM.f;
};
ShadowViewport.prototype.updateCache = function(newCTM) {
  this.activeState.zoom = newCTM.a;
  this.activeState.x = newCTM.e;
  this.activeState.y = newCTM.f;
};
ShadowViewport.prototype.pendingUpdate = false;
ShadowViewport.prototype.updateCTMOnNextFrame = function() {
  if (!this.pendingUpdate) {
    this.pendingUpdate = true;
    this.requestAnimationFrame.call(window, this.updateCTMCached);
  }
};
ShadowViewport.prototype.updateCTM = function() {
  SvgUtils.setCTM(this.viewport, this.getCTM(), this.defs);
  this.pendingUpdate = false;
};
module.exports = function(viewport, options) {
  return new ShadowViewport(viewport, options);
};
