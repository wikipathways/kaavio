/* */ 
var _ = require("lodash");
var highland = require("highland");
var httpErrors = require("./http-errors");
var internalContext = require("./context.json!systemjs-json");
var JsonldMatcher = require("./jsonld-matcher");
var request = require("request");
var csv = require("csv-streamify");
var csvOptions = {
  objectMode: true,
  delimiter: '\t'
};
var Utils = require("./utils");
var Dataset = function(instance) {
  'use strict';
  function _getAll() {
    function init() {
      var source = instance.config.datasetsMetadataIri;
      return highland(request({
        url: source,
        withCredentials: false
      }).pipe(csv(csvOptions))).map(function(array) {
        return {
          '@context': internalContext,
          _displayName: array[0],
          _systemCode: array[1],
          webPage: array[2],
          _iriPattern: array[3],
          exampleIdentifier: array[4],
          _bridgeDbType: array[5],
          organism: array[6],
          _isPrimary: array[7] === '1',
          _miriamRootUrn: array[8],
          identifierPattern: array[9],
          _standardName: array[10]
        };
      }).map(function(dataset) {
        return _.omit(dataset, function(value) {
          return value === '' || _.isNaN(value) || _.isNull(value) || _.isUndefined(value);
        });
      }).map(function(dataset) {
        dataset.name = _([dataset._displayName, dataset._standardName]).uniq().compact().value();
        var iriPattern = dataset._iriPattern;
        var identifierPattern = dataset.identifierPattern;
        if (!!iriPattern) {
          dataset.uriRegexPattern = iriPattern.replace('$id', _getIdentifierPatternWithoutBeginEndRestriction(identifierPattern));
          var indexOfSid = iriPattern.length - 3;
          if (iriPattern.indexOf('$id') === indexOfSid) {
            dataset['owl:sameAs'] = dataset['owl:sameAs'] || [];
            dataset['owl:sameAs'].push(iriPattern.substr(0, indexOfSid));
          }
        }
        dataset['@type'] = 'Dataset';
        return dataset;
      }).map(function(dataset) {
        if (!!dataset._miriamRootUrn && dataset._miriamRootUrn.indexOf('urn:miriam:') > -1) {
          dataset.preferredPrefix = dataset._miriamRootUrn.substring(11, dataset._miriamRootUrn.length);
          dataset['@id'] = 'http://identifiers.org/' + dataset.preferredPrefix;
          dataset['owl:sameAs'] = dataset['owl:sameAs'] || [];
          dataset['owl:sameAs'].push(dataset._miriamRootUrn);
        }
        delete dataset._miriamRootUrn;
        return dataset;
      }).map(function(dataset) {
        if (!!dataset._bridgeDbType) {
          dataset.subject = [];
          if (dataset._bridgeDbType === 'gene' || dataset._bridgeDbType === 'probe' || dataset.preferredPrefix === 'go') {
            dataset.subject.push('gpml:GeneProduct');
            dataset.subject.push('biopax:DnaReference');
          } else if (dataset._bridgeDbType === 'probe') {
            dataset.subject.push('probe');
          } else if (dataset._bridgeDbType === 'rna') {
            dataset.subject.push('gpml:Rna');
            dataset.subject.push('biopax:RnaReference');
          } else if (dataset._bridgeDbType === 'protein') {
            dataset.subject.push('gpml:Protein');
            dataset.subject.push('biopax:ProteinReference');
          } else if (dataset._bridgeDbType === 'metabolite') {
            dataset.subject.push('gpml:Metabolite');
            dataset.subject.push('biopax:SmallMoleculeReference');
          } else if (dataset._bridgeDbType === 'pathway') {
            dataset.subject.push('gpml:Pathway');
            dataset.subject.push('biopax:Pathway');
          } else if (dataset._bridgeDbType === 'ontology') {
            dataset.subject.push('owl:Ontology');
          } else if (dataset._bridgeDbType === 'interaction') {
            dataset.subject.push('biopax:Interaction');
          }
        }
        dataset.alternatePrefix = [dataset._systemCode];
        return dataset;
      });
    }
    return Utils._runOnceGlobal('dataset', init);
  }
  function _getIdentifierPatternWithoutBeginEndRestriction(identifierPattern) {
    identifierPattern = identifierPattern || '.*';
    var identifierPatternWithoutBeginEndRestriction = '(' + identifierPattern.replace(/(^\^|\$$)/g, '') + ')';
    return identifierPatternWithoutBeginEndRestriction;
  }
  function get(args) {
    return query(args).head();
  }
  function query(args) {
    if (_.isEmpty(args)) {
      return _getAll().map(JsonldMatcher._removeNormalizedProperties);
    }
    var keysThatIdentifyDatasets = ['@id', 'preferredPrefix', 'alternatePrefix', 'name'];
    var alternateFilters = [];
    if (!!args.exampleResource) {
      alternateFilters.push(highland.curry(function(exampleResource, referenceDataset) {
        var uriRegexPatternRegExp = new RegExp(referenceDataset.uriRegexPattern);
        return !!exampleResource && !!referenceDataset.uriRegexPattern && uriRegexPatternRegExp.test(exampleResource);
      }, args.exampleResource));
    }
    if (!!args.exampleIdentifier) {
      alternateFilters.push(highland.curry(function(exampleIdentifier, referenceDataset) {
        var identifierPatternRegExp = new RegExp(referenceDataset.identifierPattern);
        return !!exampleIdentifier && !!referenceDataset.identifierPattern && referenceDataset._isPrimary && identifierPatternRegExp.test(exampleIdentifier);
      }, args.exampleIdentifier));
    }
    return _getAll().collect().flatMap(function(datasets) {
      return JsonldMatcher._find(args, highland(datasets), 'datasetsFormattedForComparison', keysThatIdentifyDatasets, alternateFilters);
    });
  }
  function convertPreferredPrefixToSystemCode(preferredPrefix) {
    return getByPreferredPrefix(preferredPrefix).map(function(dataset) {
      if (!dataset) {
        var message = 'No BridgeDb-supported dataset available for ' + 'preferredPrefix + "' + preferredPrefix + '"';
        return new Error(message);
      }
      return dataset._systemCode;
    });
  }
  return {
    convertPreferredPrefixToSystemCode: convertPreferredPrefixToSystemCode,
    get: get,
    _getIdentifierPatternWithoutBeginEndRestriction: _getIdentifierPatternWithoutBeginEndRestriction,
    query: query
  };
};
module.exports = Dataset;
