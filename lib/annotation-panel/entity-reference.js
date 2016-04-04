var _ = require('lodash');
var Annotation = require('./annotation-panel');
var BridgeDb = require('bridgedb');
var formatter = require('./formatter');

module.exports = function(kaavio) {
  'use strict';

  var bridgeDb = new BridgeDb({
    organism: kaavio.sourceData.pvjson.organism
  });

  var jsonldRx = kaavio.jsonldRx;

  var pathwaySearchUriStub = '/index.php?title=Special:SearchPathways&doSearch=1&query=';

  function expandEntityReference(metadata, entityReference) {
    var entityReferenceFallbackData = {
      identifier: metadata.label,
      isDataItemIn: {
        _isPrimary: true
      }
    };
    var id = entityReference.id;
    if (id) {
      entityReference.id = id;

      // If an IRI is provided but not a dataset name
      entityReferenceFallbackData.isDataItemIn.name = 'More information';
    }
    jsonldRx.defaultsDeep(entityReference, entityReferenceFallbackData);
    return entityReference;
  }

  /**
   * Data required to render the annotation panel.
   *
   * @typedef {object} AnnotationData
   * @param {string} AnnotationData.header
   * @param {string} AnnotationData.description
   * @param {ListItem[]} AnnotationData.listItems
   */

  /**
   * Entries in the key/value(s) table section of the annotation panel.
   *
   * @typedef {object} ListItem
   * @param {string} ListItem.key
   * @param {ListItemValue[]} ListItem.values
   */

  /**
   * Entries in the value(s) section of the table section
   * of the annotation panel.
   *
   * @typedef {object} ListItemValue
   * @param {string} ListItemValue.title This appears to always be
   *                                     the entityReference db, which
   *                                     would indicate it's the same as
   *                                     the ListItem.key, meaning it is
   *                                     not needed, right? Or is it only
   *                                     required for the sorting?
   * @param {string} ListItemValue.text
   * @param {string} ListItemValue._isPrimary Used for the sorting
   * @param {string} [ListItemValue.uri]
   */

  /**
   * Build the annotationData required to render the annotation panel using
   * only the information provided (not using any information from BridgeDb)
   *
   * @param {object} metadata
   * @param {object} entityReference
   * @return {object} preloadedData same format as annotationData
   */
  function getPreloadedData(metadata, entityReference) {
    var preloadedData = {};
    preloadedData.header = metadata.label;
    preloadedData.description = metadata.description;
    preloadedData.listItems = [];

    if (_.isEmpty(entityReference.isDataItemIn.name)) {
      return preloadedData;
    }

    var listItemValue = {
      text: entityReference.identifier
    };

    if (entityReference.id) {
      listItemValue.uri = entityReference.id;
    }

    preloadedData.listItems.push({
      key: entityReference.isDataItemIn.name,
      values: [listItemValue]
    });
    return preloadedData;
  }

  var addWikiPathwaysSearchItem = function(searchAtWikiPathwaysListItem, annotationData) {
    annotationData.listItems.push(searchAtWikiPathwaysListItem);
    return annotationData;
  }

  function render(args) {
    var metadata = args.metadata;
    var entityReference = expandEntityReference(metadata, args.entityReference);

    var pathwaySearchQuery;
    if (metadata.description === 'CellularComponent') {
      // if it's a Nucleus, etc.
      pathwaySearchQuery = entityReference.id;
    } else {
      // if it's an entity reference for a DataNode, e.g., for a protein
      pathwaySearchQuery = metadata.label;
    }
    var searchAtWikiPathwaysListItem = {
      key:'Find other pathways containing',
      values: [{
        text: pathwaySearchQuery,
        uri: pathwaySearchUriStub + pathwaySearchQuery
      }]
    };

    var renderWithWikiPathwaysSearch = _.flow(
        addWikiPathwaysSearchItem.bind(undefined, searchAtWikiPathwaysListItem),
        Annotation.render.bind(undefined, kaavio)
    );

    var renderWithWikiPathwaysSearchFallback = _.flow(
        getPreloadedData.bind(undefined, metadata),
        renderWithWikiPathwaysSearch
    )
    renderWithWikiPathwaysSearchFallback(entityReference);

    if (entityReference.id.indexOf('identifiers.org') > -1 ||
        entityReference.id.indexOf('bridgedb.org') > -1) {
      // dereference the BridgeDB IRI to get multiple xrefs
      var bridgedbArgs = metadata;
      if (entityReference.id.indexOf('identifiers.org') > -1) {
        bridgedbArgs.id = entityReference.id;
      } else if (entityReference.id.indexOf('bridgedb.org') > -1) {
        bridgedbArgs.bridgedbUri = entityReference.id;
      }

      bridgeDb.xref.get(bridgedbArgs)
      .doOnError(function(err, push) {
        err.message = (err.message || '') + ' in Kaavio.entityReference';
        console.error('err');
        console.error(err);
        throw err;
      })
      .toArray()
      .flatMap(function(xrefs) {
        var primaryResource = _.find(xrefs, function(xref) {
          return xref.id === entityReference.id;
        }) || entityReference || xrefs[0];

        return formatter.formatListForDisplay({
          input: xrefs,
          primaryResource: primaryResource,
          label: metadata.label,
          description: metadata.description
        });
      })
      .subscribe(function(annotationData) {
        if (!_.isEmpty(annotationData.listItems)) {
          renderWithWikiPathwaysSearch(annotationData);
        }
      }, console.error);
    } else if (entityReference.id) {
      var xrefWithContext = {
        '@context': kaavio.sourceData.pvjson['@context'],
        '@graph':{entityReference: entityReference.id}
      };
      jsonldRx.expand(xrefWithContext).subscribe(function(expandedXref) {
        var entityReferenceIri = 'http://www.biopax.org/release/biopax-level3.owl#entityReference';
        var xrefIri = expandedXref[0][entityReferenceIri][0].id;

        var directLinkData;
        if (xrefIri.indexOf('wikipathways') > -1 && xrefIri.search(/WP\d{1,5}(\_r\d+)?$/) > -1) {
          var wikipathwaysId = xrefIri.match(/WP\d{1,5}(\_r\d+)?$/)[0];
          directLinkData = {
            'header': metadata.label,
            'description': metadata.description,
            'listItems': [{key: 'WikiPathways', values: [{text: wikipathwaysId, uri: xrefIri}]}]
          };
        } else if (xrefIri.search(/GO:\d{7}$/) > -1) {
          // because this is none of the types that BridgeDB handles,
          // I'm only expecting GO Cell Ontology terms here
          var goId = xrefIri.match(/GO:\d{7}$/)[0];
          directLinkData = {
            'header': entityReference.id,
            'description': '',
            'listItems': [{
              key: 'GO Cellular Component Ontology',
              values: [{text: goId, uri: xrefIri}]
            }]
          };
        } else {
          // TODO use data-sources.txt and identifiers.org to make this prettier
          directLinkData = {
            'header': metadata.label,
            'description': metadata.description,
            'listItems':[{
              key: entityReference.isDataItemIn.name || 'More information',
              values: [{
                text: xrefIri,
                uri: xrefIri
              }]
            }]
          };
        }
        renderWithWikiPathwaysSearch(directLinkData);
      }, function(err) {
        throw err;
      });
    } else {
      document.querySelector('.annotation').style.visibility = 'hidden';
    }
  }

  return {
    render:render
  };
};
