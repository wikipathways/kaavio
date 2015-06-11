var m = require('mithril');

module.exports = function(privateInstance) {
  var containerElement = privateInstance.containerElement;
  var diagramContainerElement;

  //module for footerOpenButton
  //for simplicity, we use this module to namespace the model classes
  var footerOpenButton = {};

  //the view-model,
  footerOpenButton.vm = (function() {
    var vm = {};

    vm.stateMappings = {
      closed: {
        style: 'visibility: visible; '
      },
      open: {
        style: 'visibility: hidden; '
      }
      // nothing displays for disabled
    };

    vm.label = m.prop('Open');

    vm.init = function() {
      vm.onunload = function() {
        console.log('unloading footerOpenButton module');
      };
    };

    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  footerOpenButton.controller = function() {
    footerOpenButton.vm.init();
  };

  //here's the view
  footerOpenButton.view = function() {
    var vm = footerOpenButton.vm;
    vm.stateMapping = vm.stateMappings[
      privateInstance.kaavioComponent.vm.state.footer()];
    return m('div', {
      'onclick': function onClick(e) {
        privateInstance.kaavioComponent.vm.state.footer('open');
      },
      'style': vm.stateMapping.style,
      'class': 'editor-open-control editor-' +
          privateInstance.kaavioComponent.vm.state.footer() +
          ' label label-default'
    }, [
      m('span.glyphicon.glyphicon-chevron-up[aria-hidden="true"]'),
      m('span', {}, ' ' + vm.label()),
    ])
  };

  return footerOpenButton;

};
