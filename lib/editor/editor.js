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

  //the view-model,
  editor.vm = (function() {
    var vm = {};

    vm.init = function() {

      vm.state = m.prop(m.route.param('editorState'));

      if (vm.state() === 'open') {
        var editorTabsComponent = editor.editorTabsComponent = new EditorTabsComponent(kaavio);

        kaavio.containerElement.addEventListener('kaaviodiagramelementclick', function(event) {
          if (!event.detail.selectedPvjsElement) {
            return vm.init(kaavio);
          }
        });

        /***********************************************
         * DataNode onclick event handler
         **********************************************/
        /*
        vm.selectedPvjsElement = m.prop(kaavio.editor.selectedPvjsElement);
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
            return vm.init(kaavio);
          }

          editorTabsComponent.vm.onClickDiagramContainer(kaavio.editor.selectedPvjsElement);

          vm.selectedPvjsElement(kaavio.editor.selectedPvjsElement);
        }
        //*/

        editorTabsComponent.vm.init(kaavio);
      }

      vm.onunload = function() {
        vm.state(m.route.param('editorState'));
        // TODO remove this once we can verify it's not needed.
        // Right now, it duplicates the call at the bottom.
        vm[m.route.param('editorState')]();
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
        vm.state('open');
        editorTabsComponentContainerElement = containerElement.querySelector(
            '.kaavio-editor-tabs');

        kaavio.on('rendered', function() {
          kaavio.containerElement.addEventListener(
              'click', vm.onClickDiagramContainer, false);
          //m.endComputation();
        });
      };

      vm.closed = function() {
        kaavio.kaavioComponent.vm.state.footer('closed');
        editor.vm.state('closed');

        if (!!kaavio.containerElement) {
          //clearSelection();
          save();
          kaavio.containerElement.removeEventListener(
              'click', vm.onClickDiagramContainer, false);
          editor.editorTabsComponent.vm.close();
          kaavio.panZoom.resizeDiagram();
        }
      };

      vm.disabled = vm.closed;

      //vm[m.route.param('editorState')]();
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
    if (editor.vm.state() === 'open') {
      return [
        m('div.kaavio-editor-tabs', {
          onchange: m.withAttr('value', editor.vm.updateTester),
          value: editor.vm.tester()
        }),
        editor.editorTabsComponent.view()
      ];
    } else {
      return;
    }
  };

  function cancel() {
    //clearSelection();
    close();
  }

  function save() {
    if (editor.editorTabsComponent.vm.dataChanged()) {
      var kaaviodatachangeEvent = new CustomEvent('kaaviodatachange', {
        detail: {
          pvjson: kaavio.sourceData.pvjson
        }
      });
      containerElement.dispatchEvent(kaaviodatachangeEvent);
    }
  }

  return editor;

};
