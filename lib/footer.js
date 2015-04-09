var _ = require('lodash');
var insertCss = require('insert-css');
var fs = require('fs');
var m = require('mithril');

var css = [
  fs.readFileSync(__dirname + '/footer.css')
];

module.exports = function(privateInstance) {
  var containerElement = privateInstance.containerElement;
  css.map(insertCss);

  //module for footer
  //for simplicity, we use this module to namespace the model classes
  var footer = {};

  //the view-model,
  footer.vm = (function() {
    var vm = {};

    vm.init = function() {
      vm.state = privateInstance.kaavioComponent.vm.state.footer;

      vm.onunload = function() {
        console.log('unloading footer module');
        vm[vm.state()]();
      };

      vm.open = function() {
        window.setTimeout(function() {
          privateInstance.panZoom.resizeDiagram();
        }, 1000);
      };

      vm.closed = function() {
        vm.state('closed');
        privateInstance.panZoom.resizeDiagram();
      };

    };
    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  footer.controller = function() {
    footer.vm.init();
  };

  //here's the view
  footer.view = function() {
    console.log('footer state');
    console.log(footer.vm.state());
    if (footer.vm.state() === 'closed') {
      return;
    } else if (footer.vm.state() === 'open') {
      return [
        m('section.kaavio-footer.kaavio-footer-open', {}, [
          privateInstance.editor.view()
        ])
      ];
    }
  };

  return footer;

};
