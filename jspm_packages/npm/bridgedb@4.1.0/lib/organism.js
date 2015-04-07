/* */ 
(function(process) {
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
  var JsonldMatcher = require("./jsonld-matcher");
  var Utils = require("./utils");
  var Organism = function(instance) {
    'use strict';
    var latinNameToIriMappings = {
      'Anopheles gambiae': 'http://identifiers.org/taxonomy/7165',
      'Arabidopsis thaliana': 'http://identifiers.org/taxonomy/3702',
      'Aspergillus niger': 'http://identifiers.org/taxonomy/5061',
      'Bacillus subtilis': 'http://identifiers.org/taxonomy/1423',
      'Bos taurus': 'http://identifiers.org/taxonomy/9913',
      'Caenorhabditis elegans': 'http://identifiers.org/taxonomy/6239',
      'Canis familiaris': 'http://identifiers.org/taxonomy/9615',
      'Ciona intestinalis': 'http://identifiers.org/taxonomy/7719',
      'Danio rerio': 'http://identifiers.org/taxonomy/7955',
      'Drosophila melanogaster': 'http://identifiers.org/taxonomy/7227',
      'Escherichia coli': 'http://identifiers.org/taxonomy/562',
      'Equus caballus': 'http://identifiers.org/taxonomy/9796',
      'Gallus gallus': 'http://identifiers.org/taxonomy/9031',
      'Gibberella zeae': 'http://identifiers.org/taxonomy/5518',
      'Glycine max': 'http://identifiers.org/taxonomy/3847',
      'Homo sapiens': 'http://identifiers.org/taxonomy/9606',
      'Hordeum vulgare': 'http://identifiers.org/taxonomy/4513',
      'Macaca mulatta': 'http://identifiers.org/taxonomy/9544',
      'Mus musculus': 'http://identifiers.org/taxonomy/10090',
      'Mycobacterium tuberculosis': 'http://identifiers.org/taxonomy/1773',
      'Ornithorhynchus anatinus': 'http://identifiers.org/taxonomy/9258',
      'Oryza indica': 'http://identifiers.org/taxonomy/39946',
      'Oryza sativa': 'http://identifiers.org/taxonomy/4530',
      'Oryza sativa Indica Group': 'http://identifiers.org/taxonomy/39946',
      'Populus trichocarpa': 'http://identifiers.org/taxonomy/3694',
      'Pan troglodytes': 'http://identifiers.org/taxonomy/9598',
      'Rattus norvegicus': 'http://identifiers.org/taxonomy/10116',
      'Saccharomyces cerevisiae': 'http://identifiers.org/taxonomy/4932',
      'Solanum lycopersicum': 'http://identifiers.org/taxonomy/4081',
      'Sus scrofa': 'http://identifiers.org/taxonomy/9823',
      'Vitis vinifera': 'http://identifiers.org/taxonomy/29760',
      'Xenopus tropicalis': 'http://identifiers.org/taxonomy/8364',
      'Zea mays': 'http://identifiers.org/taxonomy/4577'
    };
    function _convertToLatinName(organismIdentifier) {
      return _normalize(organismIdentifier).map(function(organism) {
        return !!organism.name && !!organism.name.la && organism.name.la;
      });
    }
    var createEntityReferenceToOrganismTransformationStream = function() {
      return highland.pipeline(function(sourceStream) {
        return highland(sourceStream).flatMap(_getByEntityReference);
      });
    };
    function get(searchCriteria) {
      if (_.isEmpty(searchCriteria)) {
        throw new Error('No searchCriteria specified for organism.get');
      }
      return query(searchCriteria).head();
    }
    var _getAll = function() {
      var path = 'contents';
      var source = instance.config.baseIri + path;
      return highland(request({
        url: source,
        withCredentials: false
      }).pipe(csv(csvOptions))).map(function(array) {
        var names = {};
        var englishName = array[0];
        var latinName = array[1];
        if (englishName !== 'null') {
          names.en = englishName;
        }
        if (latinName !== 'null') {
          names.la = latinName;
        }
        return {
          '@context': [{
            name: {
              '@id': 'biopax:name',
              '@container': '@language'
            },
            Organism: 'http://identifiers.org/snomedct/410607006'
          }],
          '@id': latinNameToIriMappings[latinName],
          '@type': 'Organism',
          name: names
        };
      });
    };
    var _getBySystemCodeAndIdentifier = function(systemCode, identifier) {
      var exists = highland.curry(instance.entityReference.exists, systemCode, identifier);
      return query().flatFilter(function(organism) {
        return exists(organism.name.la);
      }).head();
    };
    function _getByEntityReference(entityReference) {
      var entityReferenceStream;
      var systemCodeExists = !!entityReference.isDataItemIn && (entityReference.isDataItemIn._systemCode || _.isArray(entityReference.isDataItemIn.alternatePrefix) && entityReference.isDataItemIn.alternatePrefix[0]);
      if (!systemCodeExists) {
        entityReferenceStream = instance.entityReference.enrich(entityReference, {
          bridgeDbXrefsUrl: false,
          dataset: true,
          organism: false
        });
      } else {
        entityReferenceStream = highland([entityReference]);
      }
      return entityReferenceStream.flatMap(function(entityReference) {
        var organism = entityReference.organism;
        if (!!organism) {
          return _normalize(organism);
        }
        var systemCode = entityReference.isDataItemIn._systemCode || _.isArray(entityReference.isDataItemIn.alternatePrefix) && entityReference.isDataItemIn.alternatePrefix[0];
        var identifier = entityReference.identifier;
        if (!!systemCode && !!identifier) {
          return _getBySystemCodeAndIdentifier(systemCode, identifier);
        } else {
          console.warn('Cannot get organism by entityReference.');
          return entityReference;
        }
      });
    }
    function _getInstanceOrganism(searchCriteria) {
      var searchCriteriaUsed = instance.instanceOrganismNonNormalized || searchCriteria;
      function initMethod() {
        return query(searchCriteriaUsed);
      }
      return Utils._runOncePerInstance(instance, 'instanceOrganism', initMethod).head();
    }
    function _normalize(organism) {
      var organismIdentifier;
      if (_.isString(organism)) {
        organismIdentifier = organism;
      } else if (_.isPlainObject(organism)) {
        organismIdentifier = organism.name || organism.latin || organism.english;
      }
      if (!organismIdentifier) {
        console.log(organism);
        throw new Error('Cannot normalize above provided organism.');
      }
      var normalizedOrganismIdentifier = JsonldMatcher._normalizeText(organismIdentifier);
      return _getAll().filter(function(organism) {
        var names = organism.name;
        var latinName = names.la;
        var latinNameComponents = latinName.split(' ');
        var latinNameAbbreviated = latinNameComponents[0][0] + latinNameComponents[1];
        var englishName = names.en;
        return JsonldMatcher._normalizeText(latinName) === normalizedOrganismIdentifier || JsonldMatcher._normalizeText(latinNameAbbreviated) === normalizedOrganismIdentifier || JsonldMatcher._normalizeText(englishName) === normalizedOrganismIdentifier;
      }).head();
    }
    function query(searchCriteria) {
      if (_.isEmpty(searchCriteria)) {
        return Utils._runOnceGlobal('organisms', _getAll);
      }
      var typeToFunctionMapping = {
        Organism: _normalize,
        EntityReference: _getByEntityReference
      };
      var providedType;
      if (_.isString(searchCriteria)) {
        providedType = 'Organism';
      } else {
        providedType = searchCriteria['@type'] || 'Organism';
      }
      providedType = Utils._arrayify(providedType);
      var supportedType = _(typeToFunctionMapping).keys().intersection(providedType).first();
      if (!!supportedType) {
        return typeToFunctionMapping[supportedType](searchCriteria);
      } else {
        throw new Error('Cannot get organism by specified type(s): "' + providedType + '"');
      }
    }
    function _setInstanceOrganism(organism, normalize) {
      if (normalize === null || typeof normalize === 'undefined') {
        normalize = true;
      }
      instance.instanceOrganismNonNormalized = organism;
      if (normalize) {
        return _getInstanceOrganism(organism);
      }
    }
    return {
      createEntityReferenceToOrganismTransformationStream: createEntityReferenceToOrganismTransformationStream,
      get: get,
      _getInstanceOrganism: _getInstanceOrganism,
      query: query,
      _setInstanceOrganism: _setInstanceOrganism
    };
  };
  exports = module.exports = Organism;
})(require("process"));
