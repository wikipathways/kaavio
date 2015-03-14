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
  var diagramContainerElement;
  var editorTabsComponentContainerElement;
  css.map(insertCss);

  var editorTabsComponent = new EditorTabsComponent(privateInstance);

  //module for editor
  //for simplicity, we use this module to namespace the model classes
  var editor = {};

  //the view-model,
  editor.vm = (function() {
    var vm = {};

    vm.init = function(privateInstance) {
      vm.state = m.route.param('editorState');

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
        diagramContainerElement = containerElement.querySelector('.diagram-container');
        editorTabsComponentContainerElement = containerElement.querySelector(
            '.kaavio-editor-tabs');

        /*
        m.startComputation();
        diagramContainerElement.addEventListener('click', function(e) {
          console.log(e);
        }, false);
        m.endComputation();
        //*/

        //* TODO this is kludgy.
        window.setTimeout(function() {
          document.querySelector('.diagram-container').addEventListener(
              'click', onClickDiagramContainer, false);
          privateInstance.panZoom.resizeDiagram();
        }, 1000);
        //*/

      };

      vm.closed = function() {
        privateInstance.kaavioComponent.vm.state.footer('closed');

        if (!!diagramContainerElement) {
          diagramContainerElement.removeEventListener('click');
          clearSelection();
          privateInstance.panZoom.resizeDiagram();
          editorTabsComponent.vm.close();
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
          onchange: m.withAttr('value',
                      editor.vm.updateTester),
          value: editor.vm.tester()
        }),
        editorTabsComponent.view()
      ];
    } else {
      return;
    }
  };

  /***********************************************
   * DataNode onclick event handler
   **********************************************/
  function onClickDiagramContainer(event) {
    m.startComputation();

    var selectedElementId = event.target.id;

    if (!!privateInstance.editor.selectedPvjsElement) {
      privateInstance.publicInstance.highlighter.attenuate(
          '#' + privateInstance.editor.selectedPvjsElement.id);
    }

    privateInstance.publicInstance.highlighter.highlight('#' + selectedElementId, null, {
      backgroundColor: 'white', borderColor: 'green'
    });

    privateInstance.editor.selectedPvjsElement = privateInstance.sourceData.pvjson.elements.filter(
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

  function clearSelection() {
    if (privateInstance.editor.selectedPvjsElement) {
      privateInstance.publicInstance.highlighter.attenuate(
          '#' + privateInstance.editor.selectedPvjsElement.id);
    }

    privateInstance.editor.selectedPvjsElement = null;
  }

  function cancel() {
    clearSelection();
    close();
  }

  function save(gpmlDoc) {
    var serializerInstance = new XMLSerializer();
    var gpmlString = serializerInstance.serializeToString(gpmlDoc[0]);

    console.log('');
    console.log('');
    console.log('');
    console.log('*********************************************************************');
    console.log('*********************************************************************');
    console.log('');
    console.log('Updated GPML file as string:');
    console.log('');
    console.log(gpmlString);
    console.log('');
    console.log('*********************************************************************');
    console.log('*********************************************************************');
    console.log('');

    console.log('You have successfully updated a GPML DataNode.');
    console.warn('This change applies to your browser only.');
    console.warn('You still need to save it to the backend.');

    var pvjsdatachangeEvent = new CustomEvent('pvjsdatachange', {
      detail: {
        pvjson: pvjs.sourceData.pvjson,
        gpml: gpmlString
      }
    });
    containerElement.dispatchEvent(pvjsdatachangeEvent);
  }

  return editor;

};
