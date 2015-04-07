/* */ 
var _ = require("lodash");
var highland = require("highland");
var BridgeDb = require("../../index");
var bridgeDb1 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
var entityReference2 = {'@id': 'http://webservice.bridgedb.org/Human/xrefs/L/1234'};
bridgeDb1.xref.get(_.clone(entityReference2)).each(function(entityReferenceXref) {
  console.log('xref (single) for:');
  console.log(JSON.stringify(entityReference2, null, '\t'));
  console.log('**********************************************');
  console.log(JSON.stringify(entityReferenceXref, null, '\t'));
});
