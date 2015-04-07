/* */ 
var core = require("../level2/core").dom.level2.core,
    HtmlToDom = require("../browser/htmltodom").HtmlToDom,
    domToHtml = require("../browser/domtohtml").domToHtml,
    htmlencoding = require("../browser/htmlencoding"),
    HTMLEncode = htmlencoding.HTMLEncode,
    HTMLDecode = htmlencoding.HTMLDecode;
core = Object.create(core);
core.VALIDATION_ERR = 16;
core.TYPE_MISMATCH_ERR = 17;
core.DOMImplementation.prototype.getFeature = function(feature, version) {};
var DOCUMENT_POSITION_DISCONNECTED = core.Node.prototype.DOCUMENT_POSITION_DISCONNECTED = 0x01;
var DOCUMENT_POSITION_PRECEDING = core.Node.prototype.DOCUMENT_POSITION_PRECEDING = 0x02;
var DOCUMENT_POSITION_FOLLOWING = core.Node.prototype.DOCUMENT_POSITION_FOLLOWING = 0x04;
var DOCUMENT_POSITION_CONTAINS = core.Node.prototype.DOCUMENT_POSITION_CONTAINS = 0x08;
var DOCUMENT_POSITION_CONTAINED_BY = core.Node.prototype.DOCUMENT_POSITION_CONTAINED_BY = 0x10;
var DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = core.Node.prototype.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 0x20;
var DOCUMENT_TYPE_NODE = core.Node.prototype.DOCUMENT_TYPE_NODE;
core.Node.prototype.compareDocumentPosition = function compareDocumentPosition(otherNode) {
  if (!(otherNode instanceof core.Node)) {
    throw Error("Comparing position against non-Node values is not allowed");
  }
  var thisOwner,
      otherOwner;
  if (this.nodeType === this.DOCUMENT_NODE)
    thisOwner = this;
  else
    thisOwner = this.ownerDocument;
  if (otherNode.nodeType === this.DOCUMENT_NODE)
    otherOwner = otherNode;
  else
    otherOwner = otherNode.ownerDocument;
  if (this === otherNode)
    return 0;
  if (this === otherNode.ownerDocument)
    return DOCUMENT_POSITION_FOLLOWING + DOCUMENT_POSITION_CONTAINED_BY;
  if (this.ownerDocument === otherNode)
    return DOCUMENT_POSITION_PRECEDING + DOCUMENT_POSITION_CONTAINS;
  if (thisOwner !== otherOwner)
    return DOCUMENT_POSITION_DISCONNECTED;
  if (this.nodeType === this.ATTRIBUTE_NODE && this._childNodes && this._childNodes._toArray().indexOf(otherNode) !== -1)
    return DOCUMENT_POSITION_FOLLOWING + DOCUMENT_POSITION_CONTAINED_BY;
  if (otherNode.nodeType === this.ATTRIBUTE_NODE && otherNode._childNodes && otherNode._childNodes._toArray().indexOf(this) !== -1)
    return DOCUMENT_POSITION_PRECEDING + DOCUMENT_POSITION_CONTAINS;
  var point = this;
  var parents = [];
  var previous = null;
  while (point) {
    if (point == otherNode)
      return DOCUMENT_POSITION_PRECEDING + DOCUMENT_POSITION_CONTAINS;
    parents.push(point);
    point = point._parentNode;
  }
  point = otherNode;
  previous = null;
  while (point) {
    if (point == this)
      return DOCUMENT_POSITION_FOLLOWING + DOCUMENT_POSITION_CONTAINED_BY;
    var location_index = parents.indexOf(point);
    if (location_index !== -1) {
      var smallest_common_ancestor = parents[location_index];
      var this_index = smallest_common_ancestor._childNodes._toArray().indexOf(parents[location_index - 1]);
      var other_index = smallest_common_ancestor._childNodes._toArray().indexOf(previous);
      if (this_index > other_index) {
        return DOCUMENT_POSITION_PRECEDING;
      } else {
        return DOCUMENT_POSITION_FOLLOWING;
      }
    }
    previous = point;
    point = point._parentNode;
  }
  return DOCUMENT_POSITION_DISCONNECTED;
};
core.Node.prototype.isSameNode = function(other) {
  return (other === this);
};
core.Node.prototype.__defineGetter__('textContent', function() {
  switch (this.nodeType) {
    case this.COMMENT_NODE:
    case this.CDATA_SECTION_NODE:
    case this.PROCESSING_INSTRUCTION_NODE:
    case this.TEXT_NODE:
      return this.nodeValue;
    case this.ATTRIBUTE_NODE:
    case this.DOCUMENT_FRAGMENT_NODE:
    case this.ELEMENT_NODE:
    case this.ENTITY_NODE:
    case this.ENTITY_REFERENCE_NODE:
      var out = '';
      for (var i = 0; i < this.childNodes.length; ++i) {
        if (this.childNodes[i].nodeType !== this.COMMENT_NODE && this.childNodes[i].nodeType !== this.PROCESSING_INSTRUCTION_NODE) {
          out += this.childNodes[i].textContent || '';
        }
      }
      return out;
    default:
      return null;
  }
});
core.Node.prototype.__defineSetter__('textContent', function(txt) {
  for (var i = this.childNodes.length; --i >= 0; ) {
    this.removeChild(this.childNodes.item(i));
  }
  if (txt !== "" && txt != null) {
    this.appendChild(this._ownerDocument.createTextNode(txt));
  }
  return txt;
});
core.Node.prototype.isEqualNode = function(other) {
  var self = this;
  var diffValues = function() {
    for (var i = 0; i < arguments.length; i++) {
      var k = arguments[i];
      if (self[k] != other[k])
        return (true);
    }
    return (false);
  };
  var diffNamedNodeMaps = function(snnm, onnm) {
    if ((snnm == null) && (onnm == null))
      return (false);
    if ((snnm == null) || (onnm == null))
      return (true);
    if (snnm.length != onnm.length)
      return (true);
    var js = [];
    for (var j = 0; j < onnm.length; j++) {
      js[j] = j;
    }
    for (var i = 0; i < snnm.length; i++) {
      var found = false;
      for (var j = 0; j < js.length; j++) {
        if (snnm.item(i).isEqualNode(onnm.item(js[j]))) {
          found = true;
          js.splice(j, 1);
          break;
        }
      }
      if (!found)
        return (true);
    }
    return (false);
  };
  var diffNodeLists = function(snl, onl) {
    if ((snl == null) && (onl == null))
      return (false);
    if ((snl == null) || (onl == null))
      return (true);
    if (snl.length != onl.length)
      return (true);
    for (var i = 0; i < snl.length; i++) {
      if (!snl.item(i).isEqualNode(onl.item(i)))
        return (true);
    }
    return (false);
  };
  if (!other)
    return (false);
  if (this.isSameNode(other))
    return (true);
  if (this.nodeType != other.nodeType)
    return (false);
  if (diffValues('nodeName', 'localName', 'namespaceURI', 'prefix', 'nodeValue'))
    return (false);
  if (diffNamedNodeMaps(this.attributes, other.attributes))
    return (false);
  if (diffNodeLists(this.childNodes, other.childNodes))
    return (false);
  if (this.nodeType == DOCUMENT_TYPE_NODE) {
    if (diffValues('publicId', 'systemId', 'internalSubset'))
      return (false);
    if (diffNamedNodeMaps(this.entities, other.entities))
      return (false);
    if (diffNamedNodeMaps(this.notations, other.notations))
      return (false);
  }
  return (true);
};
core.Node.prototype.setUserData = function(key, data, handler) {
  var r = this[key] || null;
  this[key] = data;
  return (r);
};
core.Node.prototype.getUserData = function(key) {
  var r = this[key] || null;
  return (r);
};
core.Attr.prototype.__defineGetter__('isId', function() {
  return (this.name.toLowerCase() === 'id');
});
core.UserDataHandler = function() {};
core.UserDataHandler.prototype.NODE_CLONED = 1;
core.UserDataHandler.prototype.NODE_IMPORTED = 2;
core.UserDataHandler.prototype.NODE_DELETED = 3;
core.UserDataHandler.prototype.NODE_RENAMED = 4;
core.UserDataHandler.prototype.NODE_ADOPTED = 5;
core.UserDataHandler.prototype.handle = function(operation, key, data, src, dst) {};
core.DOMError = function(severity, message, type, relatedException, relatedData, location) {
  this._severity = severity;
  this._message = message;
  this._type = type;
  this._relatedException = relatedException;
  this._relatedData = relatedData;
  this._location = location;
};
core.DOMError.prototype = {};
core.DOMError.prototype.SEVERITY_WARNING = 1;
core.DOMError.prototype.SEVERITY_ERROR = 2;
core.DOMError.prototype.SEVERITY_FATAL_ERROR = 3;
core.DOMError.prototype.__defineGetter__('severity', function() {
  return this._severity;
});
core.DOMError.prototype.__defineGetter__('message', function() {
  return this._message;
});
core.DOMError.prototype.__defineGetter__('type', function() {
  return this._type;
});
core.DOMError.prototype.__defineGetter__('relatedException', function() {
  return this._relatedException;
});
core.DOMError.prototype.__defineGetter__('relatedData', function() {
  return this._relatedData;
});
core.DOMError.prototype.__defineGetter__('location', function() {
  return this._location;
});
core.DOMConfiguration = function() {
  var possibleParameterNames = {
    'canonical-form': [false, true],
    'cdata-sections': [true, false],
    'check-character-normalization': [false, true],
    'comments': [true, false],
    'datatype-normalization': [false, true],
    'element-content-whitespace': [true, false],
    'entities': [true, false],
    'infoset': [undefined, true, false],
    'namespaces': [true, false],
    'namespace-declarations': [true, false],
    'normalize-characters': [false, true],
    'split-cdata-sections': [true, false],
    'validate': [false, true],
    'validate-if-schema': [false, true],
    'well-formed': [true, false]
  };
};
core.DOMConfiguration.prototype = {
  setParameter: function(name, value) {},
  getParameter: function(name) {},
  canSetParameter: function(name, value) {},
  parameterNames: function() {}
};
core.Document.prototype.__defineGetter__('domConfig', function() {
  return this._domConfig || new core.DOMConfiguration();
  ;
});
core.DOMStringList = function() {};
core.DOMStringList.prototype = {
  item: function() {},
  length: function() {},
  contains: function() {}
};
core.Document.prototype._inputEncoding = null;
core.Document.prototype.__defineGetter__('inputEncoding', function() {
  return this._inputEncoding;
});
exports.dom = {level3: {core: core}};
