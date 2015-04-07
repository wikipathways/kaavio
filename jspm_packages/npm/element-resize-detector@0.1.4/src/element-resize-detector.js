/* */ 
"use strict";
var forEach = require("./collection-utils").forEach;
var elementUtils = require("./element-utils");
var idGeneratorMaker = require("./id-generator");
var listenerHandlerMaker = require("./listener-handler");
module.exports = function(options) {
  options = options || {};
  var allowMultipleListeners = options.allowMultipleListeners === undefined ? true : false;
  var eventListenerHandler = listenerHandlerMaker();
  var idGenerator = idGeneratorMaker();
  function listenTo(elements, listener) {
    function isListenedTo(element) {
      return elementUtils.isDetectable(element) && eventListenerHandler.get(element).length;
    }
    function addListener(element, listener) {
      elementUtils.addListener(element, listener);
      eventListenerHandler.add(element, listener);
    }
    if (elements.length === undefined) {
      elements = [elements];
    }
    forEach(elements, function(element) {
      if (!elementUtils.isDetectable(element)) {
        var id = idGenerator.newId();
        return elementUtils.makeDetectable(element, id, function(element) {
          addListener(element, listener);
        });
      }
      if (isListenedTo(element) && !allowMultipleListeners) {
        return ;
      }
      return addListener(element, listener);
    });
  }
  return {listenTo: listenTo};
};
