/* */ 
var _ = require("lodash");
var argv = require("yargs").argv;
var colors = require("colors");
var diff = require("deep-diff").diff;
var fs = require("fs");
var pd = require("pretty-data").pd;
var strcase = require("tower-strcase");
var testUtils = (function() {
  'use strict';
  var jsonDiffKindMappings = {
    'E': {
      bgColor: 'bgYellow',
      color: 'black',
      name: 'Edited',
      side: 'rhs'
    },
    'N': {
      bgColor: 'bgGreen',
      color: 'black',
      name: 'New',
      side: 'rhs'
    },
    'D': {
      bgColor: 'bgRed',
      color: 'white',
      name: 'Deleted',
      side: 'lhs'
    }
  };
  var jsonDiffSideToColorMappings = {
    rhs: 'green',
    lhs: 'red'
  };
  function compareJson(actualJsonString, expectedJsonString) {
    if (actualJsonString === expectedJsonString) {
      return true;
    }
    var actualJson = JSON.parse(actualJsonString);
    if (expectedJsonString === '{}') {
      console.log('***************************************************');
      console.log('**      New Test - No Expected JSON Available    **');
      console.log('** If Actual JSON below is valid, save it as     **');
      console.log('** Expected JSON with the following command:     **');
      console.log('** gulp testClass --update=BridgeDb.Class.method **');
      console.log('***************************************************');
      displayActualJson(actualJson);
      return false;
    }
    var expectedJson = JSON.parse(expectedJsonString);
    var jsonDiffs = _.filter(diff(expectedJson, actualJson), function(jsonDiff) {
      return !jsonDiff.path || (jsonDiff.path.indexOf('xref') === -1);
    });
    if (!jsonDiffs || _.isEmpty(jsonDiffs)) {
      return true;
    }
    console.log('**************************************');
    console.log('**  jsonDiffs: Expected vs. Actual  **');
    console.log('**************************************');
    console.log(jsonDiffs);
    jsonDiffs.map(function(jsonDiff) {
      return getJsonDiffLoggers(actualJson, jsonDiff);
    }).map(function(jsonDiffLogger) {
      return jsonDiffLogger();
    });
    return false;
  }
  function displayActualJson(actualJson) {
    console.log('**************************************');
    console.log('**           Actual JSON            **');
    console.log('**************************************');
    console.log(pd.json(actualJson).white.bgBlue);
  }
  function displayDiffItemInContext(actualJson, jsonDiff) {
    if (!jsonDiff.path) {
      return console.log('');
    }
    var jsonDiffKindMapping = jsonDiffKindMappings[jsonDiff.kind];
    console.log('********************************');
    console.log((jsonDiffKindMapping.name + '. Path: ' + jsonDiff.path)[jsonDiffKindMapping.color][jsonDiffKindMapping.bgColor]);
    var lhsItem = '';
    var rhsItem = '';
    var key = _.last(jsonDiff.path);
    var replaceNthMatchIndex;
    var lhsReplaceNthMatchIndex;
    var rhsReplaceNthMatchIndex;
    var diffItemInContext = jsonDiff.path.reduce(function(previousValue, currentKey, index, array) {
      if (previousValue.hasOwnProperty(currentKey) && index < array.length - 1) {
        return previousValue[currentKey];
      } else {
        if (jsonDiff.kind === 'D') {
          var finalValue = previousValue[currentKey];
          if (_.isArray(previousValue)) {
            previousValue.push(jsonDiff.lhs);
            lhsReplaceNthMatchIndex = _.filter(_.initial(previousValue), function(element) {
              return JSON.stringify(jsonDiff.lhs) === JSON.stringify(element);
            }).length;
          } else if (_.isPlainObject(previousValue)) {
            previousValue[currentKey] = jsonDiff.lhs;
          }
        }
        if (_.isArray(previousValue)) {
          rhsReplaceNthMatchIndex = _.filter(_.initial(previousValue, index - key + 1), function(element) {
            return JSON.stringify(jsonDiff.rhs) === JSON.stringify(element);
          }).length;
        } else if (_.isPlainObject(previousValue)) {
          lhsReplaceNthMatchIndex = rhsReplaceNthMatchIndex = 0;
        }
        return previousValue;
      }
    }, actualJson);
    var value = diffItemInContext[key];
    var lhsValue = _.isPlainObject(jsonDiff.lhs) || _.isArray(jsonDiff.lhs) ? JSON.stringify(jsonDiff.lhs) : '"' + String(jsonDiff.lhs) + '"';
    var rhsValue = _.isPlainObject(jsonDiff.rhs) || _.isArray(jsonDiff.rhs) ? JSON.stringify(jsonDiff.rhs) : '"' + String(jsonDiff.rhs) + '"';
    var diffItemInContextString = JSON.stringify(diffItemInContext);
    var rhsItemReplacement;
    if (!!jsonDiff.rhs) {
      if (_.isPlainObject(diffItemInContext)) {
        rhsItem = '"' + key + '"' + ':' + rhsValue;
      } else {
        rhsItem = rhsValue;
      }
      rhsItemReplacement = rhsItem[jsonDiffSideToColorMappings.rhs];
      diffItemInContextString = replaceNthMatch(diffItemInContextString, rhsItem, rhsReplaceNthMatchIndex, rhsItemReplacement);
    }
    if (!!jsonDiff.lhs) {
      if (_.isPlainObject(diffItemInContext)) {
        lhsItem = '"' + key + '"' + ':' + lhsValue;
      } else {
        lhsItem = lhsValue;
      }
      var lhsItemReplacement = lhsItem[jsonDiffSideToColorMappings.lhs];
      if (jsonDiff.kind === 'D') {
        diffItemInContextString = replaceNthMatch(diffItemInContextString, lhsItem, lhsReplaceNthMatchIndex, lhsItemReplacement);
      } else if (jsonDiff.kind === 'E') {
        var lhsRe = new RegExp(lhsItem, 'g');
        if (lhsRe.test(diffItemInContextString)) {
          var message = 'One ' + 'item'.yellow + ' was moved';
          diffItemInContextString = diffItemInContextString.replace(lhsRe, lhsItem.yellow);
          if (jsonDiff.rhs) {
            message += ' to make room for ' + 'another'.green;
          }
          message += '.';
          console.log(message);
        } else {
          console.log('Item was replaced.');
          console.log('Original Item:'.bold.white);
          console.log(lhsItemReplacement);
          console.log('Replacement Item (in context):'.bold.white);
        }
      }
    }
    console.log(diffItemInContextString);
  }
  function getJsonDiffLoggers(actualJson, jsonDiff) {
    if (jsonDiff.kind === 'A') {
      jsonDiff.item.path = jsonDiff.path.concat(jsonDiff.index);
      return getJsonDiffLoggers(actualJson, jsonDiff.item);
    } else if (jsonDiff.kind === 'N') {
      return function() {
        displayDiffItemInContext(actualJson, jsonDiff);
      };
    } else if (jsonDiff.kind === 'D') {
      return function() {
        displayDiffItemInContext(actualJson, jsonDiff);
      };
    } else if (jsonDiff.kind === 'E') {
      return function() {
        displayDiffItemInContext(actualJson, jsonDiff);
      };
    } else {
      return function() {
        console.log('********************************');
        console.log(('Other. Path: ' + jsonDiff.path).black.bgYellow);
        console.log('TODO'.black.bgMagenta + ': Refactor testUtils to handle this case.');
        console.log(pd.json(jsonDiff).random);
      };
    }
  }
  function getLkgDataString(lkgDataPath) {
    var lkgExists = fs.existsSync(lkgDataPath);
    var lkgDataString = lkgExists ? fs.readFileSync(lkgDataPath, {encoding: 'utf8'}) : false;
    return !!lkgDataString ? lkgDataString : '{}';
  }
  function getUpdateState(methodName) {
    var methodsToUpdate = _.isArray(argv.update) ? argv.update : [argv.update];
    var updateEnabled = methodsToUpdate.indexOf(methodName) > -1;
    if (updateEnabled) {
      console.log('Updating expected test data, overwriting existing data ' + '(if any) for current test.');
    }
    return updateEnabled;
  }
  function replaceNthMatch(original, pattern, n, replace) {
    n = n + 1;
    var parts;
    var tempParts;
    if (pattern.constructor === RegExp) {
      if (original.search(pattern) === -1) {
        return original;
      }
      parts = original.split(pattern);
      if (parts[1].search(pattern) !== 0) {
        throw {
          name: 'ArgumentError',
          message: 'RegExp must have a capture group'
        };
      }
    } else if (pattern.constructor === String) {
      parts = original.split(pattern);
      tempParts = [];
      for (var i = 0; i < parts.length; i++) {
        tempParts.push(parts[i]);
        if (i < parts.length - 1) {
          tempParts.push(pattern);
        }
      }
      parts = tempParts;
    } else {
      throw {
        name: 'ArgumentError',
        message: 'Must provide either a RegExp or String'
      };
    }
    var indexOfNthMatch = (n * 2) - 1;
    if (parts[indexOfNthMatch] === undefined) {
      return original;
    }
    if (typeof(replace) === 'function') {
      replace = replace(parts[indexOfNthMatch]);
    }
    parts[indexOfNthMatch] = replace;
    return parts.join('');
  }
  return {
    compareJson: compareJson,
    getLkgDataString: getLkgDataString,
    getUpdateState: getUpdateState
  };
})();
exports = module.exports = testUtils;
