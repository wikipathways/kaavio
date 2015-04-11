var _ = require('lodash');
var insertCss = require('insert-css');
var fs = require('fs');
var EditorTabsComponent = require('./editor-tabs-component/editor-tabs-component');
var m = require('mithril');

var css = [
  fs.readFileSync(__dirname + '/editor.css')
];

module.exports = function(privateInstance) {
  var containerElement = privateInstance.containerElement;
  var editorTabsComponentContainerElement;
  css.map(insertCss);

  var editorTabsComponent = new EditorTabsComponent(privateInstance);

  //module for editor
  //for simplicity, we use this module to namespace the model classes
  var editor = {};

  //the view-model,
  editor.vm = (function() {
    var vm = {};

    vm.init = function() {
      vm.state = m.route.param('editorState');

      /***********************************************
       * DataNode onclick event handler
       **********************************************/
      vm.onClickDiagramContainer = function(event) {
        m.startComputation();

        var selectedElementId = event.target.id;

        if (!!privateInstance.editor.selectedPvjsElement) {
          privateInstance.highlighter.attenuate(
              '#' + privateInstance.editor.selectedPvjsElement.id);
        }

        privateInstance.highlighter.highlight('#' + selectedElementId, null, {
          backgroundColor: 'white', borderColor: 'green'
        });

        privateInstance.editor.selectedPvjsElement =
            privateInstance.sourceData.pvjson.elements.filter(
                function(pvjsElement) {
              return pvjsElement.id === selectedElementId;
            })
            .map(function(pvjsElement) {
              return pvjsElement;
            })[0];

        if (!privateInstance.editor.selectedPvjsElement) {
          m.endComputation();
          return;
        }

        editorTabsComponent.vm.onClickDiagramContainer(privateInstance.editor.selectedPvjsElement);

        m.endComputation();
      }

      editorTabsComponent.vm.init(privateInstance);

      vm.onunload = function() {
        vm.state = m.route.param('editorState');
        console.log('unloading editor module');
        console.log(m.route.param('editorState'));
        vm[m.route.param('editorState')]();
        console.log(m.route.param('editorState'));
      };

      vm.tester = m.prop('');

      // react to user updating tester value
      vm.updateTester = function(newTester) {
        if (!!newTester) {
          vm.tester = m.prop(newTester);
        }
      };

      vm.open = function() {
        privateInstance.kaavioComponent.vm.state.footer('open');
        editorTabsComponentContainerElement = containerElement.querySelector(
            '.kaavio-editor-tabs');

        privateInstance.on('rendered', function() {
          privateInstance.diagramContainerElement.addEventListener(
              'click', vm.onClickDiagramContainer, false);
          //m.endComputation();
        });
      };

      // TODO this might be running twice when it should run just once
      vm.closed = function() {
        privateInstance.kaavioComponent.vm.state.footer('closed');

        if (!!privateInstance.diagramContainerElement) {
          privateInstance.diagramContainerElement.removeEventListener('click');
          clearSelection();
          privateInstance.panZoom.resizeDiagram();
          editorTabsComponent.vm.close();
          save();
        }
      };

      vm[m.route.param('editorState')]();
    };

    return vm;
  }());

  //the controller defines what part of the model is relevant for the current page
  //in our case, there's only one view-model that handles everything
  editor.controller = function() {
    editor.vm.init();
  };

  //here's the view
  editor.view = function() {
    console.log('state');
    console.log(editor.vm.state);
    if (editor.vm.state === 'open') {
      return [
        m('div.kaavio-editor-tabs', {
          onchange: m.withAttr('value', editor.vm.updateTester),
          value: editor.vm.tester()
        }),
        editorTabsComponent.view()
      ];
    } else {
      return;
    }
  };

  function clearSelection() {
    if (privateInstance.editor.selectedPvjsElement) {
      privateInstance.highlighter.attenuate(
          '#' + privateInstance.editor.selectedPvjsElement.id);
    }

    privateInstance.editor.selectedPvjsElement = null;
  }
  editor.clearSelection = clearSelection;

  function cancel() {
    clearSelection();
    close();
  }

  function save() {
    var kaaviodatachangeEvent = new CustomEvent('kaaviodatachange', {
      detail: {
        pvjson: privateInstance.sourceData.pvjson
      }
    });
    containerElement.dispatchEvent(kaaviodatachangeEvent);
    console.log('dispatched kaaviodatachange from kaavio/editor.js')
  }

  return editor;

};
