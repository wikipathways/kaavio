/* */ 
var highland = require("highland");
var BridgeDb = require("../../index");
var bridgeDb1 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
var bridgeDb2 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
bridgeDb2.entityReference.enrich([{'@id': 'http://identifiers.org/ncbigene/4292'}], {
  bridgeDbXrefsIri: true,
  context: false,
  dataset: true,
  organism: true
}).each(function(entityReferenceXrefs) {
  console.log('bridgeDb2: enriched entity reference');
  console.log(JSON.stringify(entityReferenceXrefs, null, '\t'));
});
