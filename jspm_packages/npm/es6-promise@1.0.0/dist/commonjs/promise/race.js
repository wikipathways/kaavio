/* */ 
"use strict";
var isArray = require("./utils").isArray;
function race(promises) {
  var Promise = this;
  if (!isArray(promises)) {
    throw new TypeError('You must pass an array to race.');
  }
  return new Promise(function(resolve, reject) {
    var results = [],
        promise;
    for (var i = 0; i < promises.length; i++) {
      promise = promises[i];
      if (promise && typeof promise.then === 'function') {
        promise.then(resolve, reject);
      } else {
        resolve(promise);
      }
    }
  });
}
exports.race = race;
