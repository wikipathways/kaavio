/* */ 
var BridgeDb = require("../../index");
var bridgeDb1 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
function runGetAll(runNumber, timeout, expectedIterationCount) {
  bridgeDb1.dataset.query().collect().each(function(dataset) {
    if (runNumber === 1) {
      console.log('***************************************************');
      console.log('expected iteration count: ' + expectedIterationCount);
      console.log('***************************************************');
    }
    console.log('  #' + runNumber + ' ======================');
    console.log('     Count: ' + dataset.length);
    if (dataset.length !== 132) {
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
runGetAllMultiple(0, 0, 3);
runGetAllMultiple(60, 3, 75);
runGetAllMultiple(1000, 0, 1);
var bridgeDb2 = BridgeDb({
  baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
  datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php'
});
