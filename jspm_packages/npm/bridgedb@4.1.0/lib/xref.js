/* */ 
var _ = require("lodash");
var highland = require("highland");
var httpErrors = require("./http-errors");
var jsonLdContext = require("./context.json!systemjs-json");
var request = require("request");
var csv = require("csv-streamify");
var csvOptions = {
  objectMode: true,
  delimiter: '\t'
};
var Utils = require("./utils");
var Xref = function(instance) {
  'use strict';
  function get(input, options) {
    instance.options = options || {};
    instance.options.format = instance.options.format || 'data';
    var inputStream;
    if (_.isString(input) || _.isPlainObject(input)) {
      inputStream = highland([input]);
    } else if (_.isArray(input)) {
      inputStream = highland(input);
    } else if (highland.isStream(input)) {
      inputStream = input;
    }
    return inputStream.pipe(createStream());
  }
  function createStream() {
    return highland.pipeline(function(sourceStream) {
      var options = instance.options || {};
      var specifiedEntityReference;
      return highland(sourceStream).flatMap(instance.entityReference.enrich).map(function(normalizedEntityReference) {
        specifiedEntityReference = normalizedEntityReference;
        return normalizedEntityReference;
      }).flatMap(function(normalizedEntityReference) {
        var source = _getBridgeDbIriByEntityReference(normalizedEntityReference);
        return highland(request({
          url: source,
          withCredentials: false
        }).pipe(csv(csvOptions)));
      }).errors(function(err, push) {
        console.log(err.toString());
        console.log('in xref.createStream()');
      }).map(function(array) {
        return {
          identifier: array[0],
          db: array[1]
        };
      }).collect().sequence().flatMap(instance.entityReference.enrich).collect().flatMap(function(entityReferences) {
        return entityReferences.map(instance.addContext);
      });
    });
  }
  function _getBridgeDbIriByEntityReference(entityReference) {
    var systemCode = entityReference.isDataItemIn.alternatePrefix[0];
    var path = encodeURIComponent(entityReference.organism.name.la) + '/xrefs/' + encodeURIComponent(systemCode) + '/' + encodeURIComponent(entityReference.identifier);
    return instance.config.baseIri + path;
  }
  return {
    createStream: createStream,
    _getBridgeDbIriByEntityReference: _getBridgeDbIriByEntityReference,
    get: get
  };
};
exports = module.exports = Xref;
