/* */ 
var _ = require("lodash");
var highland = require("highland");
var internalContext = require("./context.json!systemjs-json");
var jsonld = require("jsonld");
var url = require("url");
global.bridgeDb = global.bridgeDb || {};
var Utils = (function() {
  'use strict';
  function _arrayify(input) {
    input = !!input ? input : [];
    return !_.isArray(input) ? [input] : input;
  }
  var _runOnce = function(scope, dataName, initMethod) {
    var isGlobal;
    if (scope === 'global') {
      isGlobal = true;
      scope = global.bridgeDb;
    }
    var fullCache = scope[dataName];
    var loadingStream = scope[dataName + 'LoadingStream'];
    if (!!fullCache) {
      return highland(fullCache);
    } else if (!!loadingStream) {
      var partialCache = scope[dataName + 'PartialCache'];
      return highland(partialCache).concat(loadingStream.fork());
    } else {
      scope[dataName + 'PartialCache'] = [];
      var runOnceStream = initMethod().map(function(data) {
        scope[dataName + 'PartialCache'].push(data);
        return data;
      }).errors(function(err, push) {
        console.log('in Utils._runOnce');
        throw err;
      });
      runOnceStream.fork().last().each(function(data) {
        scope[dataName] = scope[dataName + 'PartialCache'];
      });
      scope[dataName + 'LoadingStream'] = runOnceStream;
      return runOnceStream.fork();
    }
  };
  var _runOnceGlobal = function(dataName, initMethod) {
    return _runOnce('global', dataName, initMethod);
  };
  var _runOncePerInstance = function(instance, dataName, initMethod) {
    return _runOnce(instance, dataName, initMethod);
  };
  var _defaultsDeep = _.partialRight(_.merge, function deep(value, other) {
    return _.merge(value, other, deep);
  });
  return {
    _arrayify: _arrayify,
    _runOnceGlobal: _runOnceGlobal,
    _runOncePerInstance: _runOncePerInstance,
    _defaultsDeep: _defaultsDeep
  };
}());
exports = module.exports = Utils;
