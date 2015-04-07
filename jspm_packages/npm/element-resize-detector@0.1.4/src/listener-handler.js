/* */ 
"use strict";
var elementUtils = require("./element-utils");
module.exports = function() {
  var eventListeners = {};
  function getListeners(element) {
    return eventListeners[elementUtils.getId(element)];
  }
  function addListener(element, listener) {
    var id = elementUtils.getId(element);
    if (!eventListeners[id]) {
      eventListeners[id] = [];
    }
    eventListeners[id].push(listener);
  }
  return {
    get: getListeners,
    add: addListener
  };
};
