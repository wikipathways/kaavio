var m = require('mithril');

module.exports = function(privateInstance) {
  var containerElement = privateInstance.containerElement;
  var diagramContainerElement;

  //module for editorOpenButton
  //for simplicity, we use this module to namespace the model classes
  var editorOpenButton = {};

  //the view-model,
  editorOpenButton.vm = (function() {
    var vm = {};

    vm.init = function(privateInstance) {
      vm.state = privateInstance.editor.vm.state;

      vm.onunload = function() {
        console.log('unloading editorOpenButton module');
        console.log(m.route.param('state'));
        vm[m.route.param('state')]();
        console.log(m.route.param('state'));
      };
    };
    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  editorOpenButton.controller = function() {
    editorOpenButton.vm.init();
  };

  //here's the view
  editorOpenButton.view = function() {
    console.log('editor state in editor open button');
    console.log(editorOpenButton.vm.state);
    if (editorOpenButton.vm.state === 'closed') {
      return m('div.editor-open-control.editor-' + editorOpenButton.vm.state +
          '.label.label-default', {}, [
        m('a[href="/editor/open"]', {
          config: m.route,
        }, [
          m('span.glyphicon.glyphicon-chevron-up[aria-hidden="true"]', {}, 'Quick Edit'),
        ])
      ]);
    } else {
      return;
    }
  };

  return editorOpenButton;

};
