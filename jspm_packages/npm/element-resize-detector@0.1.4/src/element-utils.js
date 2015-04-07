/* */ 
"use strict";
var forEach = require("./collection-utils").forEach;
var utils = module.exports = {};
utils.getId = function(element) {
  return element.getAttribute("elq-target-id");
};
utils.isDetectable = function(element) {
  return getObject(element);
};
utils.addListener = function(element, listener) {
  if (!utils.isDetectable(element)) {
    throw new Error("Element is not detectable.");
  }
  var object = getObject(element);
  object.contentDocument.defaultView.addEventListener("resize", function() {
    listener(element);
  });
};
utils.makeDetectable = function(element, id, callback) {
  function onObjectLoad() {
    var objectDocument = this.contentDocument;
    var style = objectDocument.createElement("style");
    style.innerHTML = "html, body { margin: 0; padding: 0 } div { -webkit-transition: opacity 0.01s; -ms-transition: opacity 0.01s; -o-transition: opacity 0.01s; transition: opacity 0.01s; opacity: 0; }";
    objectDocument.head.appendChild(style);
    this.style.cssText = "display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; padding: 0; margin: 0; opacity: 0; z-index: -1000; pointer-events: none;";
    callback(element);
  }
  element.setAttribute("elq-target-id", id);
  if (getComputedStyle(element).position === "static") {
    element.style.position = "relative";
  }
  var object = document.createElement("object");
  object.type = "text/html";
  object.data = "about:blank";
  object.onload = onObjectLoad;
  object.setAttribute("elq-object-id", id);
  element.appendChild(object);
};
function getObject(element) {
  return forEach(element.children, function(child) {
    if (child.hasAttribute("elq-object-id")) {
      return child;
    }
  });
}
