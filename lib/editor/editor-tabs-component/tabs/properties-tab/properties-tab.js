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
    vm.selection = kaavio.editor.vm.selection;
    vm.disabled = m.prop(true);

    vm.selectionSource = kaavio.editor.vm.selectionSource;
    vm.resetSource = kaavio.editor.vm.resetSource;

    vm.selectionSource.subscribe(function(selection) {
      vm.disabled(false);
      var pvjsElement = selection().pvjsElement();

      pvjsElement.color = pvjsElement.color || '#000000';
      colorPickerControl.vm.color(pvjsElement.color);

      pvjsElement.fontWeight = !!pvjsElement.fontWeight ?
          pvjsElement.fontWeight : 'normal';
      vm.fontWeight(pvjsElement.fontWeight);

      pvjsElement.fontStyle = !!pvjsElement.fontStyle ?
          pvjsElement.fontStyle : 'normal';
      vm.fontStyle(pvjsElement.fontStyle);

      selection().pvjsElement(pvjsElement);

      // Kludge to handle cases where we change the pvjson, but the change doesn't constitute
      // a real change to the GPML, e.g., we explicitly define an implied value.
      if (!kaavio.editor.editorTabsComponent.vm.dataChanged()) {
        kaavio.editor.editorTabsComponent.vm.originalPvjsonAsString = JSON.stringify(
            kaavio.sourceData.pvjson);
      }
    });

    vm.resetSource.subscribe(function() {
        vm.reset();
      });

    colorPickerControl.vm.init();
    colorPickerControl.vm.disabled = vm.disabled;

    //propertiesTab.vm.saveButtonClass = 'btn-default';

    vm.cancel = function() {
      //propertiesTab.vm.saveButtonClass = 'btn-default';
      kaavio.editor.cancel();
    };

    vm.reset = function() {
      colorPickerControl.vm.color('#000000');
      vm.fontStyle = m.prop('normal');
      vm.fontWeight = m.prop('normal');
      vm.disabled(true);
    };

    vm.onunload = function() {
      // do something
    };

    vm.fontStyle = m.prop('normal');
    vm.setFontStyle = function() {
      var pvjsElement = vm.selection().pvjsElement();
      if (!pvjsElement) {
        return;
      }
      if (vm.fontStyle() === 'normal') {
        vm.fontStyle('italic');
      } else {
        vm.fontStyle('normal');
      }
      pvjsElement.fontStyle = vm.fontStyle();

      kaavio.$element.select('#text-for-' + pvjsElement.id)
        .style('font-style', vm.fontStyle());

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
    }

    vm.fontWeight = m.prop('normal');
    vm.setFontWeight = function() {
      var pvjsElement = vm.selection().pvjsElement();
      if (!pvjsElement) {
        return;
      }
      if (vm.fontWeight() === 'normal') {
        vm.fontWeight('bold');
      } else {
        vm.fontWeight('normal');
      }
      pvjsElement.fontWeight = vm.fontWeight();
      kaavio.$element.select('#text-for-' + pvjsElement.id)
        .style('font-weight', vm.fontWeight());

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
    }

    vm.save = function() {
      var pvjsElement = vm.selection().pvjsElement();
      if (!pvjsElement) {
        return console.warn('No pvjsElement. Cannot save.');
      }

      var color = colorPickerControl.vm.color();

      if (color === pvjsElement.color) {
        // No changes
        return;
      }

      // TODO why do I need to do this? Shouldn't it happen from just
      // changing the pvjsElement?
      var selectionId = pvjsElement.id;
      var elementFromPvjs = _.find(kaavio.sourceData.pvjson.elements, {id: selectionId});

      pvjsElement.color = elementFromPvjs.color = color;

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);
      updateDiagram(kaavio, selectionId, color);
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
  var component = propertiesTab;
  //var component = this;
  var vm = component.vm;
  if (!vm) {
    return;
  }
  var selection = vm.selection;
  if (!selection || !selection()) {
    return;
  }
  //var pvjsElement = selection().pvjsElement();
  colorPickerControl.vm.disabled(!selection().id());
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
        style: selection().id() ? null : 'pointer-events: none; ',
        onclick: vm.setFontWeight
      }, [
        m('span.glyphicon.icon-bold.form-control', {
          style: selection().id() ?
              vm.fontWeightToButtonStyleMappings[
                  selection().pvjsElement().fontWeight] : null
        })
      ]),
      m('button.btn.btn-sm.btn-default', {
        style: selection().id() ? null : 'pointer-events: none; ',
        onclick: vm.setFontStyle
      }, [
        m('span.glyphicon.icon-italic.form-control', {
          style: selection().id() ?
              vm.fontStyleToButtonStyleMappings[
                  selection().pvjsElement().fontStyle] : null
        })
      ]),
    ]),
  ]);
};

function updateDiagram(kaavio, selectionId, color) {
  kaavio.$element.select('#' + selectionId)
    .style('stroke', color);
  kaavio.$element.select('#text-for-' + selectionId)
    .style('fill', color);
}

module.exports = propertiesTab;
