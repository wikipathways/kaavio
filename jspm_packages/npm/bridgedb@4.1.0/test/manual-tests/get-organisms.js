/* */ 
var _ = require("lodash");
var BridgeDb = require("../../index");
var highland = require("highland");
var bridgeDb1 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
var bridgeDb2 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
function runGetAll(runNumber, timeout, expectedIterationCount) {
  bridgeDb1.organism.getAll().collect().each(function(organisms) {
    if (runNumber === 1) {
      console.log('***************************************************');
      console.log('expected iteration count: ' + expectedIterationCount);
      console.log('***************************************************');
    }
    console.log('  #' + runNumber + ' ======================');
    console.log('     Count: ' + organisms.length);
    if (organisms.length !== 31) {
      console.log('********************************************************');
      console.log('********************************************************');
      console.log('********************************************************');
      console.log('********************************************************');
      console.log('********************************************************');
      console.log('********************************************************');
      console.log('********************************************************');
    }
    console.log('     Timeout: ' + timeout + 'ms');
  });
}
function getTimeout(index, start, step) {
  return start + index * step;
}
function runGetAllMultiple(start, step, expectedIterationCount) {
  var runNumber = 0;
  for (var i = 0; i < expectedIterationCount; i += 1) {
    setTimeout(function() {
      runNumber += 1;
      var timeout = getTimeout(runNumber, start, step);
      runGetAll(runNumber, timeout, expectedIterationCount);
    }, getTimeout(i, start, step));
  }
}
var input1 = {
  name: 'Human',
  '@type': 'Organism'
};
var input1 = {
  '@id': 'http://identifiers.org/ncbigene/4292',
  '@type': 'EntityReference'
};
bridgeDb1.organism._getInstanceOrganism(_.clone(input1)).each(function(organism) {
  console.log('organism for provided input:');
  console.log(input1);
  console.log(organism);
  console.log(JSON.stringify(organism, null, '\t'));
});
