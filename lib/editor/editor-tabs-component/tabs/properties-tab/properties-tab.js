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

  vm.fontStyleToButtonStyleMappings = {
    italic: 'background-color: lightgray; ',
    normal: ''
  };

  vm.fontWeightToButtonStyleMappings = {
    bold: 'background-color: lightgray; ',
    normal: ''
  };

  vm.init = function(kaavio) {

    vm.selectedPvjsElement = kaavio.diagramComponent.vm.selectedPvjsElement;
    vm.activeSelection = kaavio.editor.vm.activeSelection;

    colorPickerControl.vm.init();
    colorPickerControl.vm.disabled(!vm.selectedPvjsElement());

    vm.onClickDiagramContainer = function(event) {
      var eventDetail = event.detail;
      if (!eventDetail || !eventDetail.selectedPvjsElement) {
        return vm.reset();
      }

      var selectedPvjsElement = event.detail.selectedPvjsElement;

      selectedPvjsElement.color = selectedPvjsElement.color || '#000000';
      colorPickerControl.vm.color(selectedPvjsElement.color);

      selectedPvjsElement.fontWeight = !!selectedPvjsElement.fontWeight ?
          selectedPvjsElement.fontWeight : 'normal';
      vm.fontWeight(selectedPvjsElement.fontWeight);

      selectedPvjsElement.fontStyle = !!selectedPvjsElement.fontStyle ?
          selectedPvjsElement.fontStyle : 'normal';
      vm.fontStyle(selectedPvjsElement.fontStyle);

      vm.selectedPvjsElement(selectedPvjsElement);

      // Kludge to handle cases where we change the pvjson, but the change doesn't constitute
      // a real change to the GPML, e.g., we explicitly define an implied value.
      if (!kaavio.editor.editorTabsComponent.vm.dataChanged()) {
        kaavio.editor.editorTabsComponent.vm.originalPvjsonAsString = JSON.stringify(
            kaavio.sourceData.pvjson);
      }
    };
    kaavio.containerElement.addEventListener(
        'kaaviodiagramelementclick', vm.onClickDiagramContainer, false);

    //propertiesTab.vm.saveButtonClass = 'btn-default';

    vm.cancel = function() {
      //propertiesTab.vm.saveButtonClass = 'btn-default';
      kaavio.editor.cancel();
    };

    vm.reset = function() {
      colorPickerControl.vm.color('#000000');
      vm.fontStyle = m.prop('normal');
      vm.fontWeight = m.prop('normal');
    };

    vm.onunload = function() {
      kaavio.containerElement.removeEventListener(
          'kaaviodiagramelementclick', vm.onClickDiagramContainer, false);
    };

    vm.fontStyle = m.prop('normal');
    vm.setFontStyle = function() {
      var selectedPvjsElement = vm.selectedPvjsElement();
      if (!selectedPvjsElement) {
        return;
      }
      if (vm.fontStyle() === 'normal') {
        vm.fontStyle('italic');
      } else {
        vm.fontStyle('normal');
      }
      selectedPvjsElement.fontStyle = vm.fontStyle();
      console.log('selectedPvjsElement');
      console.log(selectedPvjsElement);

      kaavio.$element.select('#text-for-' + selectedPvjsElement.id)
        .style('font-style', vm.fontStyle());

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
    }

    vm.fontWeight = m.prop('normal');
    vm.setFontWeight = function() {
      var selectedPvjsElement = vm.selectedPvjsElement();
      if (!selectedPvjsElement) {
        return;
      }
      if (vm.fontWeight() === 'normal') {
        vm.fontWeight('bold');
      } else {
        vm.fontWeight('normal');
      }
      selectedPvjsElement.fontWeight = vm.fontWeight();
      console.log('selectedPvjsElement');
      console.log(selectedPvjsElement);
      kaavio.$element.select('#text-for-' + selectedPvjsElement.id)
        .style('font-weight', vm.fontWeight());

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
    }

    vm.save = function() {
      var selectedPvjsElement = vm.selectedPvjsElement();
      if (!selectedPvjsElement) {
        return console.warn('No selectedPvjsElement. Cannot save.');
      }

      var color = colorPickerControl.vm.color();

      if (color === selectedPvjsElement.color) {
        // No changes
        return;
      }

      // TODO why do I need to do this? Shouldn't it happen from just
      // changing the selectedPvjsElement?
      var selectedElementId = selectedPvjsElement.id;
      var elementFromPvjs = _.find(kaavio.sourceData.pvjson.elements, {id: selectedElementId});

      selectedPvjsElement.color = elementFromPvjs.color = color;

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
      updateDiagram(kaavio, selectedElementId, color);
      //propertiesTab.vm.saveButtonClass = 'btn-default';
      //vm.reset();
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
  colorPickerControl.vm.disabled(!propertiesTab.vm.activeSelection().id);
  return m('nav.kaavio-editor-properties.navbar.navbar-default.navbar-form.well.well-sm', [
    m('div.form-group.navbar-left', [
      m('div.input-group.input-group-sm.form-control', {
        onchange: propertiesTab.vm.save
      }, [
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
    m('div.form-group.navbar-left', [
      m('button[type="submit"][style="height: 44px;"].btn.form-control.' +
          propertiesTab.vm.saveButtonClass, {
        onclick: propertiesTab.vm.save
      }, [
        m('span.glyphicon.glyphicon-ok')
      ]),
    ]),
    //*/
    m('div.form-group.navbar-left', [
      m('button.btn.btn-sm.btn-default', {
        style: propertiesTab.vm.activeSelection().id ? null : 'pointer-events: none; ',
        onclick: propertiesTab.vm.setFontWeight
      }, [
        m('span.glyphicon.icon-bold.form-control', {
          style: propertiesTab.vm.selectedPvjsElement() ?
              propertiesTab.vm.fontWeightToButtonStyleMappings[
                  propertiesTab.vm.selectedPvjsElement().fontWeight] : null
        })
      ]),
      m('button.btn.btn-sm.btn-default', {
        style: propertiesTab.vm.activeSelection().id ? null : 'pointer-events: none; ',
        onclick: propertiesTab.vm.setFontStyle
      }, [
        m('span.glyphicon.icon-italic.form-control', {
          style: propertiesTab.vm.selectedPvjsElement() ?
              propertiesTab.vm.fontStyleToButtonStyleMappings[
                  propertiesTab.vm.selectedPvjsElement().fontStyle] : null
        })
      ]),
    ]),
  ]);
};

function updateDiagram(kaavio, selectedElementId, color) {
  kaavio.$element.select('#' + selectedElementId)
    .style('stroke', color);
  kaavio.$element.select('#text-for-' + selectedElementId)
    .style('fill', color);
}

module.exports = propertiesTab;
