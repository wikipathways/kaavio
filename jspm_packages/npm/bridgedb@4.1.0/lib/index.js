/* */ 
var _ = require("lodash");
var config = require("./config");
var EntityReference = require("./entity-reference");
var internalContext = require("./context.json!systemjs-json");
var Dataset = require("./dataset");
var Organism = require("./organism");
var Utils = require("./utils");
var Xref = require("./xref");
var BridgeDb = function(options) {
  var instance = {};
  options = options || {};
  instance.config = Object.create(config);
  instance.config = Utils._defaultsDeep(options, instance.config);
  instance.addContext = function(inputDoc) {
    var externalContext = inputDoc['@context'] || [];
    externalContext = _.isArray(externalContext) ? externalContext : [externalContext];
    var externalContextAfterElementsStringified = externalContext.map(JSON.stringify);
    internalContext = _.isArray(internalContext) ? internalContext : [internalContext];
    var unionContext = internalContext.filter(function(internalContextElement) {
      return externalContextAfterElementsStringified.indexOf(JSON.stringify(internalContextElement)) === -1;
    }).concat(externalContext);
    var outputDoc = {'@context': unionContext};
    _.defaults(outputDoc, inputDoc);
    return outputDoc;
  };
  instance.entityReference = Object.create(EntityReference(instance));
  instance.organism = Object.create(Organism(instance));
  if (!!options.organism) {
    instance.organism._setInstanceOrganism(options.organism, false);
  }
  instance.dataset = Object.create(Dataset(instance));
  instance.xref = Object.create(Xref(instance));
  return instance;
};
(function() {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.BridgeDb = BridgeDb;
  }
  if (!!module && !!module.exports) {
    module.exports = BridgeDb;
  }
})();
