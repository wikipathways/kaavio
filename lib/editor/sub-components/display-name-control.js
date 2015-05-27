/******************************
  * Display name control
  *****************************/

var m = require('mithril');

//module for displayNameControl
//for simplicity, we use this module to namespace the model classes
var displayNameControl = {};

//the view-model,
displayNameControl.vm = (function() {
  var vm = {}

  vm.disabled = m.prop(true);

  vm.init = function() {
    vm.displayName = m.prop('');
  }

  vm.reset = function() {
    vm.displayName('');
    vm.disabled(true);
  }

  return vm
}());

//the controller defines what part of the model is relevant for the current page
//in our case, there's only one view-model that handles everything
displayNameControl.controller = function() {
  displayNameControl.vm.init();
}

//here's the view
displayNameControl.view = function() {
  var component = this;
  var vm = component.vm;
  return [
    m('input[placeholder="Display name"].form-control.input.input-sm', {
      onchange: m.withAttr('value', vm.displayName),
      value: vm.displayName(),
      disabled: vm.disabled()
    })
  ];
};

module.exports = displayNameControl;
