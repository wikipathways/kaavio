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

    vm.editorOpenButtonToEditorStateMappings = {
      closed: {
        style: 'visibility: visible; '
      },
      open: {
        style: 'visibility: hidden; '
      }
    };

    vm.init = function() {
      vm.state = vm.editorOpenButtonToEditorStateMappings[
          privateInstance.kaavioComponent.vm.state.footer()];
      //vm.state = privateInstance.editor.vm.state;
      vm.onunload = function() {
        console.log('unloading editorOpenButton module');
        console.log(m.route.param('editorState'));
        vm[m.route.param('editorState')]();
        console.log(m.route.param('editorState'));
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
    /*
    console.log('editor state in editor open button');
    console.log(editorOpenButton.vm.state);
    //*/
    return m('a[href="/editor/open"]', {
      config: m.route,
      'style': editorOpenButton.vm.state.style,
      'class': 'editor-open-control editor-' +
          privateInstance.kaavioComponent.vm.state.footer() +
          ' label label-default'
    }, [
      m('span.glyphicon.glyphicon-chevron-up[aria-hidden="true"]'),
      m('span', {}, 'Quick Edit'),
    ])
  };

  return editorOpenButton;

};
