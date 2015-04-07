/* */ 
var _ = require("lodash");
var highland = require("highland");
var internalContext = require("./context.json!systemjs-json");
var jsonld = require("jsonld");
var createJsonldNormalizerStream = highland.ncurry(2, highland.flip(highland.wrapCallback(jsonld.normalize)), {format: 'application/nquads'});
var Utils = require("./utils");
var JsonldMatcher = (function() {
  'use strict';
  var normalizationNSBase = 'jsonldMatcher';
  var jsonldNormalizationNS = normalizationNSBase + 'JsonldNormalized';
  var textNormalizationNS = normalizationNSBase + 'TextNormalized';
  function _removeNormalizedProperties(args) {
    return _.reduce(args, function(result, value, key) {
      if (key.indexOf(normalizationNSBase) !== 0) {
        result[key] = value;
      }
      return result;
    }, {});
  }
  function _addNormalizedProperties(input, selectedKeys) {
    return highland.pairs(input).filter(function(pair) {
      return !selectedKeys ? true : selectedKeys.indexOf(pair[0]) > -1;
    }).flatMap(function(pair) {
      return _jsonldNormalizePair(pair).flatMap(function(jsonldNormalizedPair) {
        return _textNormalizePair(jsonldNormalizedPair).flatMap(function(textNormalizedPair) {
          return [pair, jsonldNormalizedPair, textNormalizedPair];
        });
      }).map(function(pairs) {
        return pairs;
      });
    }).reduce(input, function(accumulator, pair) {
      accumulator[pair[0]] = pair[1];
      return accumulator;
    });
  }
  function getFormattedForComparison(dataStream, name, selectedKeys) {
    function init() {
      return dataStream.flatMap(function(data) {
        return JsonldMatcher._addNormalizedProperties(data, selectedKeys);
      });
    }
    return Utils._runOnceGlobal(name, init).collect();
  }
  function _jsonldNormalizePair(pair) {
    var doc = {};
    doc['@context'] = internalContext;
    doc[pair[0]] = pair[1];
    return createJsonldNormalizerStream(doc).map(function(normalized) {
      var elementDelimiter = ' .\n';
      var normalizedValues = normalized.split(elementDelimiter);
      normalizedValues.pop();
      return normalizedValues;
    }).map(function(normalizedValues) {
      var key = jsonldNormalizationNS + pair[0];
      return [key, normalizedValues];
    });
  }
  function _normalizeText(inputText) {
    var stringifiedInput = inputText;
    if (!_.isString(inputText)) {
      if (_.isNumber(inputText) || _.isRegExp(inputText) || _.isDate(inputText) || _.isBoolean(inputText)) {
        stringifiedInput = inputText.toString();
      } else if (_.isPlainObject(inputText)) {
        stringifiedInput = JSON.stringify(inputText);
      } else if (_.isUndefined(inputText)) {
        stringifiedInput = 'undefined';
      } else if (_.isNull(inputText)) {
        stringifiedInput = 'null';
      } else {
        console.warn('Cannot normalize provided value "' + JSON.stringify(inputText) + '".');
        console.warn('Using toString on input.');
        stringifiedInput = inputText.toString();
      }
    }
    var identifierPattern = /[^A-Za-z0-9]/gi;
    var alphanumericText = stringifiedInput.replace(identifierPattern, '');
    var normalizedText = alphanumericText;
    if (!_.isNull(alphanumericText)) {
      normalizedText = alphanumericText.toUpperCase();
    }
    return normalizedText;
  }
  function _textNormalizePair(pair) {
    var pairStream;
    if (pair[0].indexOf(jsonldNormalizationNS) === -1) {
      pairStream = _jsonldNormalizePair(pair);
    } else {
      pairStream = highland([pair]);
    }
    return pairStream.map(function(pair) {
      var key = textNormalizationNS + (pair[0]).replace(jsonldNormalizationNS, '');
      var value;
      if (_.isArray(pair[1])) {
        value = pair[1].map(_normalizeText);
      } else {
        value = _normalizeText(pair[1]);
      }
      return [key, value];
    });
  }
  function _find(args, dataStream, name, selectedKeys, alternateFilters) {
    if (!!args['@id']) {
      args['owl:sameAs'] = args['owl:sameAs'] || [];
      args['owl:sameAs'].push(args['@id']);
      if (selectedKeys.indexOf('@id') === -1) {
        selectedKeys.push('@id');
      }
      if (selectedKeys.indexOf('owl:sameAs') === -1) {
        selectedKeys.push('owl:sameAs');
      }
    }
    alternateFilters = alternateFilters || [];
    var getPairStream = function() {
      return highland.pairs(args).filter(function(pair) {
        return selectedKeys.indexOf(pair[0]) > -1;
      });
    };
    var isEmpty = true;
    return highland(getFormattedForComparison(dataStream, name, selectedKeys)).flatMap(function(dataSet) {
      return highland([getPairStream().flatMap(function(pair) {
        return _findAttempt(pair, dataSet, 0);
      }), getPairStream().filter(function(pair) {
        return selectedKeys.indexOf(pair[0]) > -1;
      }).flatMap(function(pair) {
        return _findAttempt(pair, dataSet, 1);
      }), getPairStream().filter(function(pair) {
        return selectedKeys.indexOf(pair[0]) > -1;
      }).flatMap(function(pair) {
        return _findAttempt(pair, dataSet, 2);
      })]).concat(alternateFilters.map(function(alternateFilter) {
        return highland(dataSet).filter(alternateFilter);
      })).concat(highland([function() {
        var message = 'Could not find a match for ' + name + ' for the provided args "' + JSON.stringify(args) + '"';
        var err = new Error(message);
        return err;
      }()])).errors(function(err, push) {
        if (isEmpty) {
          return push(err);
        }
      }).flatMap(function(inputStream) {
        if (highland.isStream(inputStream) && isEmpty) {
          return inputStream.map(function(data) {
            isEmpty = false;
            return data;
          });
        } else if (!isEmpty) {
          return highland([]);
        } else {
          throw inputStream;
        }
      });
    }).map(_removeNormalizedProperties);
  }
  var pairByAttemptIndex = [function(pair) {
    return highland([pair]);
  }, _jsonldNormalizePair, function(pair) {
    return highland([pair]).flatMap(_textNormalizePair);
  }];
  function _findAttempt(pair, dataSet, attemptIndex) {
    return pairByAttemptIndex[attemptIndex](pair).flatMap(function(currentPair) {
      return highland(dataSet).filter(function(data) {
        return data[currentPair[0]] === currentPair[1] || !_.isEmpty(_.intersection(data[currentPair[0]], currentPair[1]));
      });
    });
  }
  return {
    _addNormalizedProperties: _addNormalizedProperties,
    _find: _find,
    _jsonldNormalizePair: _jsonldNormalizePair,
    _normalizeText: _normalizeText,
    _removeNormalizedProperties: _removeNormalizedProperties,
    _textNormalizePair: _textNormalizePair
  };
}());
exports = module.exports = JsonldMatcher;
