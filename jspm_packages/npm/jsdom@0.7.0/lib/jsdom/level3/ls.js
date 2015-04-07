/* */ 
var core = require("./core").dom.level3.core;
var events = require("./events").dom.level3.events;
;
var ls = {};
ls.LSException = function LSException(code) {
  this.code = code;
};
ls.LSException.prototype = {
  PARSE_ERR: 81,
  SERIALIZE_ERR: 82
};
ls.DOMImplementationLS = function DOMImplementationLS() {};
var DOMImplementationExtension = {
  MODE_SYNCHRONOUS: 1,
  MODE_ASYNCHRONOUS: 2,
  createLSParser: function(mode, schemaType) {
    return new ls.LSParser(mode, schemaType);
  },
  createLSSerializer: function() {
    return new ls.LSSerializer();
  },
  createLSInput: function() {
    return new ls.LSInput();
  },
  createLSOutput: function() {
    return new ls.LSOutput();
  }
};
Object.keys(DOMImplementationExtension).forEach(function(k, v) {
  core.DOMImplementation.prototype[k] = DOMImplementationExtension[k];
});
ls.DOMImplementationLS.prototype = DOMImplementationExtension;
core.Document.getFeature = function() {
  return DOMImplementationExtension;
};
ls.LSParser = function LSParser() {
  this._domConfig = new core.DOMConfiguration();
};
ls.LSParser.prototype = {
  get domConfig() {
    return this._domConfig;
  },
  get filter() {
    return this._filter || null;
  },
  set filter(value) {
    this._filter = value;
  },
  get async() {
    return this._async;
  },
  get busy() {
    return this._busy;
  },
  parse: function(input) {
    var doc = new core.Document();
    doc._inputEncoding = 'UTF-16';
    return doc;
  },
  parseURI: function(uri) {
    return new core.Document();
  },
  ACTION_APPEND_AS_CHILDREN: 1,
  ACTION_REPLACE_CHILDREN: 2,
  ACTION_INSERT_BEFORE: 3,
  ACTION_INSERT_AFTER: 4,
  ACTION_REPLACE: 5,
  parseWithContext: function(input, contextArg, action) {
    return new core.Node();
  },
  abort: function() {}
};
ls.LSInput = function LSInput() {};
ls.LSInput.prototype = {
  get characterStream() {
    return this._characterStream || null;
  },
  set characterStream(value) {
    this._characterStream = value;
  },
  get byteStream() {
    return this._byteStream || null;
  },
  set byteStream(value) {
    this._byteStream = value;
  },
  get stringData() {
    return this._stringData || null;
  },
  set stringData(value) {
    this._stringData = value;
  },
  get systemId() {
    return this._systemId || null;
  },
  set systemId(value) {
    this._systemId = value;
  },
  get publicId() {
    return this._publicId || null;
  },
  set publicId(value) {
    this._publicId = value;
  },
  get baseURI() {
    return this._baseURI || null;
  },
  set baseURI(value) {
    this._baseURI = value;
  },
  get encoding() {
    return this._encoding || null;
  },
  set encoding(value) {
    this._encoding = value;
  },
  get certifiedText() {
    return this._certifiedText || null;
  },
  set certifiedText(value) {
    this._certifiedText = value;
  }
};
ls.LSResourceResolver = function LSResourceResolver() {};
ls.LSResourceResolver.prototype.resolveResource = function(type, namespaceURI, publicId, systemId, baseURI) {
  return new ls.LSInput();
};
ls.LSParserFilter = function LSParserFilter() {};
ls.LSParserFilter.prototype = {
  FILTER_ACCEPT: 1,
  FILTER_REJECT: 2,
  FILTER_SKIP: 3,
  FILTER_INTERRUPT: 4,
  get whatToShow() {
    return this._whatToShow;
  },
  startElement: function(elementArg) {
    return 0;
  },
  acceptNode: function(nodeArg) {
    return nodeArg;
  }
};
ls.LSSerializer = function LSSerializer() {
  this._domConfig = new core.DOMConfiguration();
};
ls.LSSerializer.prototype = {
  get domConfig() {
    return this._domConfig;
  },
  get newLine() {
    return this._newLine || null;
  },
  set newLine(value) {
    this._newLine = value;
  },
  get filter() {
    return this._filter || null;
  },
  set filter(value) {
    this._filter = value;
  },
  write: function(nodeArg, destination) {
    return true;
  },
  writeToURI: function(nodeArg, uri) {
    return true;
  },
  writeToString: function(nodeArg) {
    return "";
  }
};
ls.LSOutput = function LSOutput() {};
ls.LSOutput.prototype = {
  get characterStream() {
    return this._characterStream || null;
  },
  set characterStream(value) {
    this._characterStream = value;
  },
  get byteStream() {
    return this._byteStream || null;
  },
  set byteStream(value) {
    this._byteStream = value;
  },
  get systemId() {
    return this._systemId || null;
  },
  set systemId(value) {
    this._systemId = value;
  },
  get encoding() {
    return this._encoding || null;
  },
  set encoding(value) {
    this._encoding = value;
  }
};
ls.LSProgressEvent = function LSProgressEvent() {};
ls.LSProgressEvent.prototype = {
  get input() {
    return this._input;
  },
  get position() {
    return this._position;
  },
  get totalSize() {
    return this._totalSize;
  }
};
ls.LSProgressEvent.prototype.__proto__ = events.Event;
ls.LSLoadEvent = function LSLoadEvent() {};
ls.LSLoadEvent.prototype = {
  get newDocument() {
    return this._newDocument;
  },
  get input() {
    return this._input;
  }
};
ls.LSLoadEvent.prototype.__proto__ = events.Event;
ls.LSSerializerFilter = function LSSerializerFilter() {};
ls.LSSerializerFilter.prototype = {get whatToShow() {
    return this._whatToShow;
  }};
module.exports.dom = {level3: {ls: ls}};
