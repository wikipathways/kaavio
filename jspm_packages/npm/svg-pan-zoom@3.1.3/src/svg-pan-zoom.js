/* */ 
var Wheel = require("./uniwheel"),
    ControlIcons = require("./control-icons"),
    Utils = require("./utilities"),
    SvgUtils = require("./svg-utilities"),
    ShadowViewport = require("./shadow-viewport");
var SvgPanZoom = function(svg, options) {
  this.init(svg, options);
};
var optionsDefaults = {
  viewportSelector: '.svg-pan-zoom_viewport',
  panEnabled: true,
  controlIconsEnabled: false,
  zoomEnabled: true,
  dblClickZoomEnabled: true,
  mouseWheelZoomEnabled: true,
  zoomScaleSensitivity: 0.2,
  minZoom: 0.5,
  maxZoom: 10,
  fit: true,
  center: true,
  refreshRate: 'auto',
  beforeZoom: null,
  onZoom: null,
  beforePan: null,
  onPan: null,
  customEventsHandler: null
};
SvgPanZoom.prototype.init = function(svg, options) {
  var that = this;
  this.svg = svg;
  this.defs = svg.querySelector('defs');
  SvgUtils.setupSvgAttributes(this.svg);
  this.options = Utils.extend(Utils.extend({}, optionsDefaults), options);
  this.state = 'none';
  var boundingClientRectNormalized = SvgUtils.getBoundingClientRectNormalized(svg);
  this.width = boundingClientRectNormalized.width;
  this.height = boundingClientRectNormalized.height;
  this.viewport = ShadowViewport(SvgUtils.getOrCreateViewport(this.svg, this.options.viewportSelector), {
    svg: this.svg,
    width: this.width,
    height: this.height,
    fit: this.options.fit,
    center: this.options.center,
    refreshRate: this.options.refreshRate,
    beforeZoom: function(oldScale, newScale) {
      if (that.viewport && that.options.beforeZoom) {
        return that.options.beforeZoom(oldScale, newScale);
      }
    },
    onZoom: function(scale) {
      if (that.viewport && that.options.onZoom) {
        return that.options.onZoom(scale);
      }
    },
    beforePan: function(oldPoint, newPoint) {
      if (that.viewport && that.options.beforePan) {
        return that.options.beforePan(oldPoint, newPoint);
      }
    },
    onPan: function(point) {
      if (that.viewport && that.options.onPan) {
        return that.options.onPan(point);
      }
    }
  });
  var publicInstance = this.getPublicInstance();
  publicInstance.setBeforeZoom(this.options.beforeZoom);
  publicInstance.setOnZoom(this.options.onZoom);
  publicInstance.setBeforePan(this.options.beforePan);
  publicInstance.setOnPan(this.options.onPan);
  if (this.options.controlIconsEnabled) {
    ControlIcons.enable(this);
  }
  this.setupHandlers();
};
SvgPanZoom.prototype.setupHandlers = function() {
  var that = this,
      prevEvt = null;
  ;
  this.eventListeners = {
    mousedown: function(evt) {
      return that.handleMouseDown(evt, null);
    },
    touchstart: function(evt) {
      var result = that.handleMouseDown(evt, prevEvt);
      prevEvt = evt;
      return result;
    },
    mouseup: function(evt) {
      return that.handleMouseUp(evt);
    },
    touchend: function(evt) {
      return that.handleMouseUp(evt);
    },
    mousemove: function(evt) {
      return that.handleMouseMove(evt);
    },
    touchmove: function(evt) {
      return that.handleMouseMove(evt);
    },
    mouseleave: function(evt) {
      return that.handleMouseUp(evt);
    },
    touchleave: function(evt) {
      return that.handleMouseUp(evt);
    },
    touchcancel: function(evt) {
      return that.handleMouseUp(evt);
    }
  };
  if (this.options.customEventsHandler != null) {
    this.options.customEventsHandler.init({
      svgElement: this.svg,
      instance: this.getPublicInstance()
    });
    var haltEventListeners = this.options.customEventsHandler.haltEventListeners;
    if (haltEventListeners && haltEventListeners.length) {
      for (var i = haltEventListeners.length - 1; i >= 0; i--) {
        if (this.eventListeners.hasOwnProperty(haltEventListeners[i])) {
          delete this.eventListeners[haltEventListeners[i]];
        }
      }
    }
  }
  for (var event in this.eventListeners) {
    this.svg.addEventListener(event, this.eventListeners[event], false);
  }
  if (this.options.mouseWheelZoomEnabled) {
    this.options.mouseWheelZoomEnabled = false;
    this.enableMouseWheelZoom();
  }
};
SvgPanZoom.prototype.enableMouseWheelZoom = function() {
  if (!this.options.mouseWheelZoomEnabled) {
    var that = this;
    this.wheelListener = function(evt) {
      return that.handleMouseWheel(evt);
    };
    Wheel.on(this.svg, this.wheelListener, false);
    this.options.mouseWheelZoomEnabled = true;
  }
};
SvgPanZoom.prototype.disableMouseWheelZoom = function() {
  if (this.options.mouseWheelZoomEnabled) {
    Wheel.off(this.svg, this.wheelListener, false);
    this.options.mouseWheelZoomEnabled = false;
  }
};
SvgPanZoom.prototype.handleMouseWheel = function(evt) {
  if (!this.options.zoomEnabled || this.state !== 'none') {
    return ;
  }
  if (evt.preventDefault) {
    evt.preventDefault();
  } else {
    evt.returnValue = false;
  }
  var delta = 0;
  if ('deltaMode' in evt && evt.deltaMode === 0) {
    if (evt.wheelDelta) {
      delta = evt.deltaY / Math.abs(evt.wheelDelta / 3);
    } else {
      delta = evt.deltaY / 120;
    }
  } else if ('mozPressure' in evt) {
    delta = evt.deltaY / 3;
  } else {
    delta = evt.deltaY;
  }
  var inversedScreenCTM = this.svg.getScreenCTM().inverse(),
      relativeMousePoint = SvgUtils.getEventPoint(evt, this.svg).matrixTransform(inversedScreenCTM),
      zoom = Math.pow(1 + this.options.zoomScaleSensitivity, (-1) * delta);
  this.zoomAtPoint(zoom, relativeMousePoint);
};
SvgPanZoom.prototype.zoomAtPoint = function(zoomScale, point, zoomAbsolute) {
  var originalState = this.viewport.getOriginalState();
  if (!zoomAbsolute) {
    if (this.getZoom() * zoomScale < this.options.minZoom * originalState.zoom) {
      zoomScale = (this.options.minZoom * originalState.zoom) / this.getZoom();
    } else if (this.getZoom() * zoomScale > this.options.maxZoom * originalState.zoom) {
      zoomScale = (this.options.maxZoom * originalState.zoom) / this.getZoom();
    }
  } else {
    zoomScale = Math.max(this.options.minZoom * originalState.zoom, Math.min(this.options.maxZoom * originalState.zoom, zoomScale));
    zoomScale = zoomScale / this.getZoom();
  }
  var oldCTM = this.viewport.getCTM(),
      relativePoint = point.matrixTransform(oldCTM.inverse()),
      modifier = this.svg.createSVGMatrix().translate(relativePoint.x, relativePoint.y).scale(zoomScale).translate(-relativePoint.x, -relativePoint.y),
      newCTM = oldCTM.multiply(modifier);
  if (newCTM.a !== oldCTM.a) {
    this.viewport.setCTM(newCTM);
  }
};
SvgPanZoom.prototype.zoom = function(scale, absolute) {
  this.zoomAtPoint(scale, SvgUtils.getSvgCenterPoint(this.svg, this.width, this.height), absolute);
};
SvgPanZoom.prototype.publicZoom = function(scale, absolute) {
  if (absolute) {
    scale = this.computeFromRelativeZoom(scale);
  }
  this.zoom(scale, absolute);
};
SvgPanZoom.prototype.publicZoomAtPoint = function(scale, point, absolute) {
  if (absolute) {
    scale = this.computeFromRelativeZoom(scale);
  }
  if (Utils.getType(point) !== 'SVGPoint' && 'x' in point && 'y' in point) {
    point = SvgUtils.createSVGPoint(this.svg, point.x, point.y);
  } else {
    throw new Error('Given point is invalid');
    return ;
  }
  this.zoomAtPoint(scale, point, absolute);
};
SvgPanZoom.prototype.getZoom = function() {
  return this.viewport.getZoom();
};
SvgPanZoom.prototype.getRelativeZoom = function() {
  return this.viewport.getRelativeZoom();
};
SvgPanZoom.prototype.computeFromRelativeZoom = function(zoom) {
  return zoom * this.viewport.getOriginalState().zoom;
};
SvgPanZoom.prototype.resetZoom = function() {
  var originalState = this.viewport.getOriginalState();
  this.zoom(originalState.zoom, true);
};
SvgPanZoom.prototype.resetPan = function() {
  this.pan(this.viewport.getOriginalState());
};
SvgPanZoom.prototype.reset = function() {
  this.resetZoom();
  this.resetPan();
};
SvgPanZoom.prototype.handleDblClick = function(evt) {
  if (evt.preventDefault) {
    evt.preventDefault();
  } else {
    evt.returnValue = false;
  }
  if (this.options.controlIconsEnabled) {
    var targetClass = evt.target.getAttribute('class') || '';
    if (targetClass.indexOf('svg-pan-zoom-control') > -1) {
      return false;
    }
  }
  var zoomFactor;
  if (evt.shiftKey) {
    zoomFactor = 1 / ((1 + this.options.zoomScaleSensitivity) * 2);
  } else {
    zoomFactor = (1 + this.options.zoomScaleSensitivity) * 2;
  }
  var point = SvgUtils.getEventPoint(evt, this.svg).matrixTransform(this.svg.getScreenCTM().inverse());
  this.zoomAtPoint(zoomFactor, point);
};
SvgPanZoom.prototype.handleMouseDown = function(evt, prevEvt) {
  if (evt.preventDefault) {
    evt.preventDefault();
  } else {
    evt.returnValue = false;
  }
  Utils.mouseAndTouchNormalize(evt, this.svg);
  if (this.options.dblClickZoomEnabled && Utils.isDblClick(evt, prevEvt)) {
    this.handleDblClick(evt);
  } else {
    this.state = 'pan';
    this.firstEventCTM = this.viewport.getCTM();
    this.stateOrigin = SvgUtils.getEventPoint(evt, this.svg).matrixTransform(this.firstEventCTM.inverse());
  }
};
SvgPanZoom.prototype.handleMouseMove = function(evt) {
  if (evt.preventDefault) {
    evt.preventDefault();
  } else {
    evt.returnValue = false;
  }
  if (this.state === 'pan' && this.options.panEnabled) {
    var point = SvgUtils.getEventPoint(evt, this.svg).matrixTransform(this.firstEventCTM.inverse()),
        viewportCTM = this.firstEventCTM.translate(point.x - this.stateOrigin.x, point.y - this.stateOrigin.y);
    this.viewport.setCTM(viewportCTM);
  }
};
SvgPanZoom.prototype.handleMouseUp = function(evt) {
  if (evt.preventDefault) {
    evt.preventDefault();
  } else {
    evt.returnValue = false;
  }
  if (this.state === 'pan') {
    this.state = 'none';
  }
};
SvgPanZoom.prototype.fit = function() {
  var viewBox = this.viewport.getViewBox(),
      newScale = Math.min(this.width / (viewBox.width - viewBox.x), this.height / (viewBox.height - viewBox.y));
  this.zoom(newScale, true);
};
SvgPanZoom.prototype.center = function() {
  var viewBox = this.viewport.getViewBox(),
      offsetX = (this.width - (viewBox.width + viewBox.x) * this.getZoom()) * 0.5,
      offsetY = (this.height - (viewBox.height + viewBox.y) * this.getZoom()) * 0.5;
  this.getPublicInstance().pan({
    x: offsetX,
    y: offsetY
  });
};
SvgPanZoom.prototype.updateBBox = function() {
  this.viewport.recacheViewBox();
};
SvgPanZoom.prototype.pan = function(point) {
  var viewportCTM = this.viewport.getCTM();
  viewportCTM.e = point.x;
  viewportCTM.f = point.y;
  this.viewport.setCTM(viewportCTM);
};
SvgPanZoom.prototype.panBy = function(point) {
  var viewportCTM = this.viewport.getCTM();
  viewportCTM.e += point.x;
  viewportCTM.f += point.y;
  this.viewport.setCTM(viewportCTM);
};
SvgPanZoom.prototype.getPan = function() {
  var state = this.viewport.getState();
  return {
    x: state.x,
    y: state.y
  };
};
SvgPanZoom.prototype.resize = function() {
  var boundingClientRectNormalized = SvgUtils.getBoundingClientRectNormalized(this.svg);
  this.width = boundingClientRectNormalized.width;
  this.height = boundingClientRectNormalized.height;
  if (this.options.controlIconsEnabled) {
    this.getPublicInstance().disableControlIcons();
    this.getPublicInstance().enableControlIcons();
  }
};
SvgPanZoom.prototype.destroy = function() {
  var that = this;
  this.beforeZoom = null;
  this.onZoom = null;
  this.beforePan = null;
  this.onPan = null;
  if (this.options.customEventsHandler != null) {
    this.options.customEventsHandler.destroy({
      svgElement: this.svg,
      instance: this.getPublicInstance()
    });
  }
  for (var event in this.eventListeners) {
    this.svg.removeEventListener(event, this.eventListeners[event], false);
  }
  this.disableMouseWheelZoom();
  this.getPublicInstance().disableControlIcons();
  this.reset();
  instancesStore = instancesStore.filter(function(instance) {
    return instance.svg !== that.svg;
  });
  delete this.options;
  delete this.publicInstance;
  delete this.pi;
  this.getPublicInstance = function() {
    return null;
  };
};
SvgPanZoom.prototype.getPublicInstance = function() {
  var that = this;
  if (!this.publicInstance) {
    this.publicInstance = this.pi = {
      enablePan: function() {
        that.options.panEnabled = true;
        return that.pi;
      },
      disablePan: function() {
        that.options.panEnabled = false;
        return that.pi;
      },
      isPanEnabled: function() {
        return !!that.options.panEnabled;
      },
      pan: function(point) {
        that.pan(point);
        return that.pi;
      },
      panBy: function(point) {
        that.panBy(point);
        return that.pi;
      },
      getPan: function() {
        return that.getPan();
      },
      setBeforePan: function(fn) {
        that.options.beforePan = fn === null ? null : Utils.proxy(fn, that.publicInstance);
        return that.pi;
      },
      setOnPan: function(fn) {
        that.options.onPan = fn === null ? null : Utils.proxy(fn, that.publicInstance);
        return that.pi;
      },
      enableZoom: function() {
        that.options.zoomEnabled = true;
        return that.pi;
      },
      disableZoom: function() {
        that.options.zoomEnabled = false;
        return that.pi;
      },
      isZoomEnabled: function() {
        return !!that.options.zoomEnabled;
      },
      enableControlIcons: function() {
        if (!that.options.controlIconsEnabled) {
          that.options.controlIconsEnabled = true;
          ControlIcons.enable(that);
        }
        return that.pi;
      },
      disableControlIcons: function() {
        if (that.options.controlIconsEnabled) {
          that.options.controlIconsEnabled = false;
          ControlIcons.disable(that);
        }
        return that.pi;
      },
      isControlIconsEnabled: function() {
        return !!that.options.controlIconsEnabled;
      },
      enableDblClickZoom: function() {
        that.options.dblClickZoomEnabled = true;
        return that.pi;
      },
      disableDblClickZoom: function() {
        that.options.dblClickZoomEnabled = false;
        return that.pi;
      },
      isDblClickZoomEnabled: function() {
        return !!that.options.dblClickZoomEnabled;
      },
      enableMouseWheelZoom: function() {
        that.enableMouseWheelZoom();
        return that.pi;
      },
      disableMouseWheelZoom: function() {
        that.disableMouseWheelZoom();
        return that.pi;
      },
      isMouseWheelZoomEnabled: function() {
        return !!that.options.mouseWheelZoomEnabled;
      },
      setZoomScaleSensitivity: function(scale) {
        that.options.zoomScaleSensitivity = scale;
        return that.pi;
      },
      setMinZoom: function(zoom) {
        that.options.minZoom = zoom;
        return that.pi;
      },
      setMaxZoom: function(zoom) {
        that.options.maxZoom = zoom;
        return that.pi;
      },
      setBeforeZoom: function(fn) {
        that.options.beforeZoom = fn === null ? null : Utils.proxy(fn, that.publicInstance);
        return that.pi;
      },
      setOnZoom: function(fn) {
        that.options.onZoom = fn === null ? null : Utils.proxy(fn, that.publicInstance);
        return that.pi;
      },
      zoom: function(scale) {
        that.publicZoom(scale, true);
        return that.pi;
      },
      zoomBy: function(scale) {
        that.publicZoom(scale, false);
        return that.pi;
      },
      zoomAtPoint: function(scale, point) {
        that.publicZoomAtPoint(scale, point, true);
        return that.pi;
      },
      zoomAtPointBy: function(scale, point) {
        that.publicZoomAtPoint(scale, point, false);
        return that.pi;
      },
      zoomIn: function() {
        this.zoomBy(1 + that.options.zoomScaleSensitivity);
        return that.pi;
      },
      zoomOut: function() {
        this.zoomBy(1 / (1 + that.options.zoomScaleSensitivity));
        return that.pi;
      },
      getZoom: function() {
        return that.getRelativeZoom();
      },
      resetZoom: function() {
        that.resetZoom();
        return that.pi;
      },
      resetPan: function() {
        that.resetPan();
        return that.pi;
      },
      reset: function() {
        that.reset();
        return that.pi;
      },
      fit: function() {
        that.fit();
        return that.pi;
      },
      center: function() {
        that.center();
        return that.pi;
      },
      updateBBox: function() {
        that.updateBBox();
        return that.pi;
      },
      resize: function() {
        that.resize();
        return that.pi;
      },
      getSizes: function() {
        return {
          width: that.width,
          height: that.height,
          realZoom: that.getZoom(),
          viewBox: that.viewport.getViewBox()
        };
      },
      destroy: function() {
        that.destroy();
        return that.pi;
      }
    };
  }
  return this.publicInstance;
};
var instancesStore = [];
var svgPanZoom = function(elementOrSelector, options) {
  var svg = Utils.getSvg(elementOrSelector);
  if (svg === null) {
    return null;
  } else {
    for (var i = instancesStore.length - 1; i >= 0; i--) {
      if (instancesStore[i].svg === svg) {
        return instancesStore[i].instance.getPublicInstance();
      }
    }
    instancesStore.push({
      svg: svg,
      instance: new SvgPanZoom(svg, options)
    });
    return instancesStore[instancesStore.length - 1].instance.getPublicInstance();
  }
};
module.exports = svgPanZoom;
