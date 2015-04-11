/***********************************
 * propertiesTab
 **********************************/

var _ = window._ = require('lodash');
var colorPickerControl = require('../../../sub-components/color-picker-control');
var editorUtils = require('../../../editor-utils');
var fs = require('fs');
var highland = require('highland');
var m = require('mithril');
var mithrilUtils = require('../../../../mithril-utils');

var propertiesTab = {};

propertiesTab.Item = function(item) {
  this.id = m.prop(item.id);
  this.name = m.prop(item.name);
};

propertiesTab.vm = (function() {

  var vm = {};
  vm.init = function(pvjs) {

    colorPickerControl.vm.init();

    propertiesTab.vm.saveButtonClass = 'btn-default';

    vm.onClickDiagramContainer = function(selectedPvjsElement) {
      colorPickerControl.vm.color(selectedPvjsElement.color);

      // TODO this is a kludge. refactor.
      propertiesTab.vm.saveButtonClass = 'btn-success';
    };

    vm.cancel = function() {
      propertiesTab.vm.saveButtonClass = 'btn-default';
      pvjs.editor.cancel();
    };

    vm.reset = function() {
      colorPickerControl.vm.color('');
      pvjs.editor.clearSelection();
    };

    vm.save = function() {
      var selectedPvjsElement = pvjs.editor.selectedPvjsElement;
      console.log('selectedPvjsElement');
      console.log(selectedPvjsElement);

      var selectedElementId = selectedPvjsElement.id;
      var elementFromPvjs = _.find(pvjs.sourceData.pvjson.elements, {id: selectedElementId});
      console.log('elementFromPvjs');
      console.log(elementFromPvjs);

      console.log('elementFromPvjs.color');
      console.log(elementFromPvjs.color);
      console.log('selectedPvjsElement.color');
      console.log(selectedPvjsElement.color);
      var color = elementFromPvjs.color = selectedPvjsElement.color =
          colorPickerControl.vm.color();
      console.log(2);
      console.log('elementFromPvjs.color');
      console.log(elementFromPvjs.color);
      console.log('selectedPvjsElement.color');
      console.log(selectedPvjsElement.color);
      updateDiagram(pvjs, selectedElementId, color);
      propertiesTab.vm.saveButtonClass = 'btn-default';
      vm.reset();
    };
  };

  return vm;
})();

propertiesTab.controller = function() {
  propertiesTab.vm.init();
};

/*
<input type='color' name='color2' value='#3355cc' />
//*/

//here's the view
propertiesTab.view = function() {
  return m('nav.pvjs-editor-properties.navbar.navbar-default.navbar-form.well.well-sm', [
    m('div.form-group.navbar-left', [
      m('div.input-group.input-group-sm.form-control', {}, [
        colorPickerControl.view()
      ]),
    ]),
    /* TODO this displays the same value as the text color input
    m('div.form-group.well.well-sm.navbar-left', [
      m('div.input-group.input-group-sm', {}, [
        m('span.glyphicon.glyphicon-text-background.input-group-addon', {}),
        colorPickerControl.view()
      ])
    ]),
    //*/
    m('div.form-group.navbar-left', [
      m('button[type="submit"][style="height: 44px;"].btn.form-control.' +
          propertiesTab.vm.saveButtonClass, {
        onclick: propertiesTab.vm.save
      }, [
        m('span.glyphicon.glyphicon-ok')
      ]),
    ]),
  ]);
};

function updateDiagram(pvjs, selectedElementId, color) {
  pvjs.$element.select('#' + selectedElementId)
    .style('stroke', color);
  pvjs.$element.select('#text-for-' + selectedElementId)
    .style('fill', color);
}

module.exports = propertiesTab;
