var _ = require('lodash');
var insertCss = require('insert-css');
var fs = require('fs');
var EditorTabsComponent = require('./editor-tabs-component/editor-tabs-component');
var m = require('mithril');

var css = [
  fs.readFileSync(__dirname + '/editor.css')
];

module.exports = function(kaavio) {
  var containerElement = kaavio.containerElement;
  var editorTabsComponentContainerElement;
  css.map(insertCss);

  //module for editor
  //for simplicity, we use this module to namespace the model classes
  var editor = {};

  var editorTabsComponent = editor.editorTabsComponent = new EditorTabsComponent(kaavio);

  //the view-model,
  editor.vm = (function() {
    var vm = {};

    vm.init = function() {
      vm.state = m.route.param('editorState');

      vm.selectedPvjsElement = m.prop(kaavio.editor.selectedPvjsElement);

      /***********************************************
       * DataNode onclick event handler
       **********************************************/
      vm.onClickDiagramContainer = function(event) {
        var selectedElementId = event.target.id;

        if (!!kaavio.editor.selectedPvjsElement) {
          kaavio.highlighter.attenuate(
              '#' + kaavio.editor.selectedPvjsElement.id);
        }

        kaavio.highlighter.highlight('#' + selectedElementId, null, {
          backgroundColor: 'white', borderColor: 'green'
        });

        kaavio.editor.selectedPvjsElement =
            kaavio.sourceData.pvjson.elements.filter(
                function(pvjsElement) {
              return pvjsElement.id === selectedElementId;
            })
            .map(function(pvjsElement) {
              return pvjsElement;
            })[0];

        if (!kaavio.editor.selectedPvjsElement) {
          m.endComputation();
          return;
        }

        editorTabsComponent.vm.onClickDiagramContainer(kaavio.editor.selectedPvjsElement);

        vm.selectedPvjsElement(kaavio.editor.selectedPvjsElement);
      }

      editorTabsComponent.vm.init(kaavio);

      vm.onunload = function() {
        vm.state = m.route.param('editorState');
        // TODO remove this once we can verify it's not needed.
        // Right now, it duplicates the call at the bottom.
        //vm[m.route.param('editorState')]();
      };

      vm.tester = m.prop('');

      // react to user updating tester value
      vm.updateTester = function(newTester) {
        if (!!newTester) {
          vm.tester = m.prop(newTester);
        }
      };

      vm.open = function() {
        kaavio.kaavioComponent.vm.state.footer('open');
        editorTabsComponentContainerElement = containerElement.querySelector(
            '.kaavio-editor-tabs');

        kaavio.on('rendered', function() {
          kaavio.diagramContainerElement.addEventListener(
              'click', vm.onClickDiagramContainer, false);
          //m.endComputation();
        });
      };

      vm.closed = function() {
        kaavio.kaavioComponent.vm.state.footer('closed');

        if (!!kaavio.diagramContainerElement) {
          kaavio.diagramContainerElement.removeEventListener(
              'click', vm.onClickDiagramContainer, false);
          clearSelection();
          kaavio.panZoom.resizeDiagram();
          editorTabsComponent.vm.close();
          save();
        }
      };

      vm.disabled = vm.closed;

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
    if (kaavio.editor.selectedPvjsElement) {
      kaavio.highlighter.attenuate(
          '#' + kaavio.editor.selectedPvjsElement.id);
    }

    kaavio.editor.selectedPvjsElement = null;
  }
  editor.clearSelection = clearSelection;

  function cancel() {
    clearSelection();
    close();
  }

  function save() {
    var kaaviodatachangeEvent = new CustomEvent('kaaviodatachange', {
      detail: {
        pvjson: kaavio.sourceData.pvjson
      }
    });
    containerElement.dispatchEvent(kaaviodatachangeEvent);
  }

  return editor;

};
