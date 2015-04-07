/* */ 
var core = require("./core").dom.level2.core,
    html = require("./html").dom.level2.html,
    utils = require("../utils"),
    cssom = require("cssom"),
    cssstyle = require("cssstyle"),
    assert = require("assert");
core.StyleSheet = cssom.StyleSheet;
core.MediaList = cssom.MediaList;
core.CSSStyleSheet = cssom.CSSStyleSheet;
core.CSSRule = cssom.CSSRule;
core.CSSStyleRule = cssom.CSSStyleRule;
core.CSSMediaRule = cssom.CSSMediaRule;
core.CSSImportRule = cssom.CSSImportRule;
core.CSSStyleDeclaration = cssstyle.CSSStyleDeclaration;
core.StyleSheetList = function() {
  this._length = 0;
};
core.StyleSheetList.prototype = {
  item: function(i) {
    return this[i];
  },
  push: function(sheet) {
    this[this._length] = sheet;
    this._length++;
  },
  get length() {
    return this._length;
  }
};
core.Document.prototype.__defineGetter__('styleSheets', function() {
  if (!this._styleSheets) {
    this._styleSheets = new core.StyleSheetList();
  }
  return this._styleSheets;
});
function fetchStylesheet(url, sheet) {
  html.resourceLoader.load(this, url, function(data, filename) {
    evaluateStylesheet.call(this, data, sheet, url);
  });
}
function evaluateStylesheet(data, sheet, baseUrl) {
  var newStyleSheet = cssom.parse(data);
  var spliceArgs = newStyleSheet.cssRules;
  spliceArgs.unshift(0, sheet.cssRules.length);
  Array.prototype.splice.apply(sheet.cssRules, spliceArgs);
  scanForImportRules.call(this, sheet.cssRules, baseUrl);
  this.ownerDocument.styleSheets.push(sheet);
}
function scanForImportRules(cssRules, baseUrl) {
  if (!cssRules)
    return ;
  for (var i = 0; i < cssRules.length; ++i) {
    if (cssRules[i].cssRules) {
      scanForImportRules.call(this, cssRules[i].cssRules, baseUrl);
    } else if (cssRules[i].href) {
      fetchStylesheet.call(this, cssRules[i].href, this.sheet);
    }
  }
}
function evaluateStyleAttribute(data) {}
function StyleAttr(node, value) {
  this._node = node;
  core.Attr.call(this, node.ownerDocument, 'style');
  if (!this._node._ignoreValueOfStyleAttr) {
    this.nodeValue = value;
  }
}
StyleAttr.prototype = {
  get nodeValue() {
    if (typeof this._node._style === 'string') {
      return this._node._style;
    } else {
      return this._node.style.cssText;
    }
  },
  set nodeValue(value) {
    this._node._style = value;
  }
};
StyleAttr.prototype.__proto__ = core.Attr.prototype;
utils.intercept(core.AttrNodeMap, 'setNamedItem', function(_super, args, attr) {
  if (attr.name == 'style') {
    attr = new StyleAttr(this._parentNode, attr.nodeValue);
  }
  return _super.call(this, attr);
});
html.HTMLElement.prototype.__defineGetter__('style', function() {
  if (typeof this._style === 'string') {
    var styleSheet = cssom.parse('dummy{' + this._style + '}');
    this._style = new cssstyle.CSSStyleDeclaration();
    if (styleSheet.cssRules.length > 0 && styleSheet.cssRules[0].style) {
      var newStyle = styleSheet.cssRules[0].style;
      for (var i = 0; i < newStyle.length; ++i) {
        var prop = newStyle[i];
        this._style.setProperty(prop, newStyle.getPropertyValue(prop), newStyle.getPropertyPriority(prop));
      }
    }
  }
  if (!this._style) {
    this._style = new cssstyle.CSSStyleDeclaration();
  }
  if (!this.getAttributeNode('style')) {
    this._ignoreValueOfStyleAttr = true;
    this.setAttribute('style');
    this._ignoreValueOfStyleAttr = false;
  }
  return this._style;
});
assert.equal(undefined, html.HTMLLinkElement._init);
html.HTMLLinkElement._init = function() {
  this.addEventListener('DOMNodeInsertedIntoDocument', function() {
    if (!/(?:[ \t\n\r\f]|^)stylesheet(?:[ \t\n\r\f]|$)/i.test(this.rel)) {
      return ;
    }
    if (this.href) {
      fetchStylesheet.call(this, this.href, this.sheet);
    }
  });
  this.addEventListener('DOMNodeRemovedFromDocument', function() {});
};
var getOrCreateSheet = function() {
  if (!this._cssStyleSheet) {
    this._cssStyleSheet = new cssom.CSSStyleSheet();
  }
  return this._cssStyleSheet;
};
html.HTMLLinkElement.prototype.__defineGetter__('sheet', getOrCreateSheet);
assert.equal(undefined, html.HTMLStyleElement._init);
html.HTMLStyleElement._init = function() {
  this.addEventListener('DOMNodeInsertedIntoDocument', function() {
    if (this.type && this.type !== 'text/css') {
      return ;
    }
    var content = '';
    Array.prototype.forEach.call(this.childNodes, function(child) {
      if (child.nodeType === child.TEXT_NODE) {
        content += child.nodeValue;
      }
    });
    evaluateStylesheet.call(this, content, this.sheet, this._ownerDocument.URL);
  });
};
html.HTMLStyleElement.prototype.__defineGetter__('sheet', getOrCreateSheet);
exports.dom = {level2: {
    html: html,
    core: core
  }};
