/* */ 
var _ = require("lodash");
var config = require("./config");
var highland = require("highland");
var httpErrors = require("./http-errors");
var request = require("request");
var csv = require("csv-streamify");
var csvOptions = {
  objectMode: true,
  delimiter: '\t'
};
var Utils = require("./utils");
var EntityReference = function(instance) {
  'use strict';
  function _addIdentifiersIri(entityReference) {
    var dataset = entityReference.isDataItemIn;
    if (!dataset || !dataset.preferredPrefix || !entityReference.identifier) {
      if (instance.debug) {
        var message = 'Could not add an identifiers.org IRI,' + ' because the provided entity' + ' reference was a dataset name and/or identifier.';
        console.warn(message);
        console.log(entityReference);
      }
      return entityReference;
    }
    if (!!entityReference['@id'] && entityReference['@id'].indexOf('identifiers.org') === -1) {
      if (!entityReference['owl:sameAs']) {
        entityReference['owl:sameAs'] = [];
      }
      entityReference['owl:sameAs'] = _.union(entityReference['owl:sameAs'], [entityReference['@id']]);
    }
    entityReference['@id'] = 'http://identifiers.org/' + dataset.preferredPrefix + '/' + entityReference.identifier;
    return entityReference;
  }
  var _addBridgeDbXrefsIri = function(entityReference) {
    if (!entityReference || !entityReference.organism || !entityReference.isDataItemIn || !entityReference.isDataItemIn.alternatePrefix || !entityReference.identifier) {
      if (instance.debug) {
        var message = 'Cannot add BridgeDb Xrefs IRI (URL).' + ' See bridgeDb.entityReference._addBridgeDbXrefsIri()' + ' method for required parameters';
        console.warn(message);
      }
      return entityReference;
    }
    entityReference.xref = entityReference.xref || [];
    var xrefs = entityReference.xref;
    xrefs = _.isArray(xrefs) ? xrefs : [xrefs];
    var bridgeDbXrefsIri = instance.xref._getBridgeDbIriByEntityReference(entityReference);
    xrefs.push(bridgeDbXrefsIri);
    return entityReference;
  };
  var createEnrichmentStream = function(options) {
    return highland.pipeline(function(sourceStream) {
      options = options || {};
      var enrichWithProvidedOptions = highland.partial(highland.flip(enrich), options);
      return highland(sourceStream).flatMap(enrichWithProvidedOptions);
    });
  };
  var enrich = function(input, options) {
    var inputStream;
    if (_.isString(input) || _.isPlainObject(input)) {
      inputStream = highland([input]);
    } else if (_.isArray(input)) {
      inputStream = highland(input);
    } else if (highland.isStream(input)) {
      inputStream = input;
    }
    options = options || {};
    options = _.defaults(options, {
      organism: true,
      context: true,
      dataset: true,
      xref: true
    });
    return inputStream.map(_expand).map(function(entityReference) {
      if (!entityReference.isDataItemIn || typeof entityReference.identifier === 'undefined') {
        var message = 'Not enough data provided to identify' + ' the specified entity reference: "' + JSON.stringify(entityReference) + '"';
        throw new Error(message);
      }
      return entityReference;
    }).flatMap(function(entityReference) {
      if (options.dataset) {
        return _enrichFromDataset(entityReference);
      } else {
        return highland([entityReference]);
      }
    }).flatMap(function(entityReference) {
      if (options.organism || options.xref) {
        return instance.organism._getInstanceOrganism(entityReference).map(function(organism) {
          if (!!organism) {
            entityReference.organism = organism;
          }
          return entityReference;
        });
      } else {
        return highland([entityReference]);
      }
    }).map(function(entityReference) {
      if (options.xref) {
        var entityReferenceWithBridgeDbXrefsIri = _addBridgeDbXrefsIri(entityReference);
        if (!options.organism) {
          delete entityReferenceWithBridgeDbXrefsIri.organism;
        }
        return entityReferenceWithBridgeDbXrefsIri;
      } else {
        return entityReference;
      }
    }).map(function(entityReference) {
      if (options.context) {
        return instance.addContext(entityReference);
      } else {
        return entityReference;
      }
    });
  };
  function _enrichFromDataset(entityReference) {
    var datasetsStream = instance.dataset.get(entityReference.isDataItemIn);
    return datasetsStream.map(function(dataset) {
      entityReference.isDataItemIn = dataset;
      entityReference.db = entityReference.db || dataset.name[0];
      var typeFromDataset = dataset.subject;
      if (!_.isEmpty(typeFromDataset)) {
        typeFromDataset = _.isArray(typeFromDataset) ? typeFromDataset : [typeFromDataset];
        entityReference['@type'] = _.union(Utils._arrayify(entityReference['@type']), typeFromDataset);
      }
      if (!!dataset.uriRegexPattern) {
        var directIri = _getDirectIri(entityReference.identifier, dataset);
        if (!entityReference['@id']) {
          entityReference['@id'] = directIri;
        } else {
          entityReference['owl:sameAs'] = entityReference['owl:sameAs'] || [];
          entityReference['owl:sameAs'].push(directIri);
        }
        dataset.exampleResource = directIri;
      }
      return entityReference;
    }).map(_addIdentifiersIri);
  }
  function exists(systemCode, identifier, organism) {
    return highland([organism]).flatMap(function(organismName) {
      var path = encodeURIComponent(organismName) + '/xrefExists/' + systemCode + '/' + identifier;
      var source = instance.config.baseIri + path;
      return highland(request({
        url: source,
        withCredentials: false
      })).map(function(buf) {
        var str = buf.toString().replace(/([^a-z])+/g, '');
        return str === 'true';
      });
    });
  }
  function _expand(entityReference) {
    if (!_.isPlainObject(entityReference)) {
      if (typeof entityReference === 'string') {
        entityReference = {'@id': entityReference};
      } else {
        var message = 'Not enough data provided to identify' + ' the specified entity reference: "' + JSON.stringify(entityReference) + '"';
        throw new Error(message);
      }
    }
    entityReference['@type'] = Utils._arrayify(entityReference['@type']);
    if (entityReference['@type'].indexOf('EntityReference') === -1) {
      entityReference['@type'].push('EntityReference');
    }
    _(iriParserPairs).map(function(iriParserPair) {
      var iriPattern = new RegExp(iriParserPair[0]);
      var iri = _.find(entityReference, function(value) {
        var valueNormalized = String(value).toLowerCase();
        return iriPattern.test(valueNormalized);
      });
      if (!_.isEmpty(iri)) {
        _.defaults(entityReference, iriParserPair[1](iri));
      }
    });
    var organism = entityReference.organism;
    if (!!organism) {
      instance.organism._setInstanceOrganism(organism, false);
    }
    entityReference.isDataItemIn = entityReference.isDataItemIn || {};
    var datasetName = entityReference.db || (!!entityReference.isDataItemIn.name && entityReference.isDataItemIn.name);
    if (!!datasetName) {
      entityReference.db = datasetName;
      entityReference.isDataItemIn.name = datasetName;
    }
    var identifier = entityReference.identifier;
    if (!!identifier) {
      entityReference.isDataItemIn.exampleIdentifier = identifier;
    }
    return entityReference;
  }
  function freeSearch(args) {
    var attributeValue = args.attribute;
    var type = args['@type'];
    var organism = args.organism || instance.instanceOrganismNonNormalized;
    if (!organism) {
      throw new Error('Missing argument "organism"');
    }
    return highland([organism]).flatMap(function(organism) {
      return instance.organism._getInstanceOrganism(organism).fork();
    }).map(function(organism) {
      return organism.name.la;
    }).map(function(organismName) {
      var path = encodeURIComponent(organismName) + '/attributeSearch/' + encodeURIComponent(attributeValue);
      return instance.config.baseIri + path;
    }).flatMap(function(source) {
      return highland(request({
        url: source,
        withCredentials: false
      }).pipe(csv(csvOptions)));
    }).errors(function(err, push) {
      console.log(err);
      console.log('in entityReference.freeSearch()');
    }).map(function(array) {
      return {
        identifier: array[0],
        db: array[1],
        displayName: array[2]
      };
    }).map(function(searchResult) {
      searchResult = _.omit(searchResult, function(value) {
        return value === 'null';
      });
      return searchResult;
    }).flatMap(enrich);
  }
  function _getDirectIri(identifier, dataset) {
    var uriRegexPattern = dataset.uriRegexPattern;
    var identifierPattern = dataset.identifierPattern;
    var identifierPatternWithoutBeginEndRestriction = instance.dataset._getIdentifierPatternWithoutBeginEndRestriction(identifierPattern);
    var directIri = uriRegexPattern.replace(identifierPatternWithoutBeginEndRestriction, identifier).toString();
    return directIri;
  }
  var iriParsers = {
    'identifiers.org': function(iri) {
      var preferredPrefix = decodeURIComponent(iri.match(/(identifiers.org\/)(.*)(?=\/.*)/)[2]);
      var identifier = decodeURIComponent(iri.match(/(identifiers.org\/.*\/)(.*)$/)[2]);
      return {
        isDataItemIn: {
          '@id': 'http://identifiers.org/' + preferredPrefix,
          preferredPrefix: preferredPrefix
        },
        identifier: identifier,
        '@id': iri
      };
    },
    'bridgedb.org': function(iri) {
      var systemCode = iri.match(/(bridgedb.org\/.*\/xrefs\/)(\w+)(?=\/.*)/)[2];
      var identifier = iri.match(/(bridgedb.org\/.*\/xrefs\/\w+\/)(.*)$/)[2];
      return {
        organism: decodeURIComponent(iri.match(/(bridgedb.org\/)(.*)(?=\/xrefs)/)[2]),
        isDataItemIn: {
          alternatePrefix: decodeURIComponent([systemCode]),
          exampleIdentifier: decodeURIComponent(identifier)
        },
        identifier: decodeURIComponent(identifier),
        bridgeDbXrefsIri: iri,
        xref: [iri]
      };
    }
  };
  var iriParserPairs = _.pairs(iriParsers);
  function map(args) {
    var targetPreferredPrefix = args.targetPreferredPrefix;
    if (!targetPreferredPrefix) {
      throw new Error('targetPreferredPrefix missing');
    }
    return instance.xref.get(args.sourceEntityReference).filter(function(entityReferenceXref) {
      return entityReferenceXref.isDataItemIn.preferredPrefix === targetPreferredPrefix;
    });
  }
  function normalize(entityReference) {
    entityReference = _expand(entityReference);
    var organism = entityReference.organism;
    if (!!organism) {
      return highland([entityReference]).flatMap(instance.organism._setInstanceOrganism).map(function(organism) {
        entityReference.organism = organism;
        return entityReference;
      });
    } else {
      return highland([entityReference]);
    }
  }
  return {
    createEnrichmentStream: createEnrichmentStream,
    enrich: enrich,
    exists: exists,
    _expand: _expand,
    freeSearch: freeSearch,
    map: map,
    normalize: normalize
  };
};
exports = module.exports = EntityReference;
