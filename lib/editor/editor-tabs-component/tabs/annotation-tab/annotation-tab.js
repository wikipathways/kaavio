/***********************************
 * annotationTab
 **********************************/

var _ = require('lodash');
var datasetControl = require('./dataset-control');
var displayNameControl = require('../../../sub-components/display-name-control');
var editorUtils = require('../../../editor-utils');
var fs = require('fs');
var XrefSearch = require('./xref-search');
var xrefTypeControl = require('./xref-type-control');
var highland = require('highland');
var identifierControl = require('./identifier-control');
var m = require('mithril');
var mithrilUtils = require('../../../../mithril-utils');

var annotationTab = {};

annotationTab.ItemList = Array;

annotationTab.Item = function(item) {
  this.id = m.prop(item.id);
  this.name = m.prop(item.name);
};

annotationTab.vm = (function() {

  var vm = {};

  vm.init = function(kaavio) {
    vm.selectedXref = m.prop();
    vm.selectedPvjsElement = kaavio.diagramComponent.vm.selectedPvjsElement;
    vm.activeSelection = kaavio.editor.vm.activeSelection;
    vm.disabled = m.prop(!vm.selectedPvjsElement());

    annotationTab.xrefSearch = new XrefSearch(annotationTab);

    vm.cancel = function() {
      vm.reset();
      kaavio.editor.cancel();
    };

    vm.onClickDiagramContainer = function(event) {
      var eventDetail = event.detail;
      if (!eventDetail || !eventDetail.selectedPvjsElement) {
        return vm.reset();
      }

      var selectedPvjsElement = eventDetail.selectedPvjsElement;

      var currentXref = _.find(kaavio.sourceData.pvjson.elements,
          function(pvjsElement) {
            return pvjsElement.id === selectedPvjsElement.entityReference;
          });

      if (!currentXref) {
        return vm.reset();
      }

      vm.selectedXref(currentXref);

      var iri = selectedPvjsElement.entityReference;
      var iriComponents = iri.split('identifiers.org');
      var iriPath = iriComponents[iriComponents.length - 1];
      var iriPathComponents = iriPath.split('/');
      var preferredPrefix = iriPathComponents[1];
      var identifier = iriPathComponents[2];

      var datasetId = 'http://identifiers.org/' + preferredPrefix;
      currentXref.isDataItemIn = {id: datasetId};

      currentXref.identifier = identifier;

      // TODO we want to edit the actual instance, not the EntityReference,
      // but right now, we're getting the displayName from the EntityReference,
      // not the textContent from the instance.
      // annotationEntity is a combination of an Xref plus the displayName of
      // the selected element, which may differ from the displayName of the
      // referenced Xref.
      //var annotationEntity = editorUtils.createAnnotationEntity(currentXref, selectedPvjsElement);
      //annotationTab.vm.updateControlValues(annotationEntity);
      annotationTab.vm.updateControlValues(selectedPvjsElement, currentXref);

      // Kludge to handle cases where we change the pvjson, but the change doesn't constitute
      // a real change to the GPML, e.g., we explicitly define an implied value.
      if (!kaavio.editor.editorTabsComponent.vm.dataChanged()) {
        kaavio.editor.editorTabsComponent.vm.originalPvjsonAsString = JSON.stringify(
            kaavio.sourceData.pvjson);
      }
    };

    kaavio.containerElement.addEventListener(
        'kaaviodiagramelementclick', vm.onClickDiagramContainer, false);

    vm.reset = function() {
      //annotationTab.vm.saveButtonClass = 'btn-default';
      xrefTypeControl.vm.init();
      datasetControl.vm.currentDataset.id = m.prop('');
      identifierControl.vm.identifier = m.prop('');
      displayNameControl.vm.displayName = m.prop('');
      vm.disabled(true);
    };

    vm.save = function() {
      //var selectedPvjsElement = kaavio.diagramComponent.vm.selectedPvjsElement();
      var selectedPvjsElement = _.find(kaavio.sourceData.pvjson.elements, function(element) {
        return kaavio.diagramComponent.vm.selectedPvjsElement().id === element.id;
      });
      if (!selectedPvjsElement) {
        return console.warn('No selectedPvjsElement. Cannot save.');
      }

      //annotationTab.vm.saveButtonClass = 'btn-default';
      var xrefType = xrefTypeControl.vm.currentXrefType.name().replace(' ', '');

      var datasetName = datasetControl.vm.currentDataset.name();
      var datasetId = datasetControl.vm.currentDataset.id();
      var identifier = identifierControl.vm.identifier();
      var entityReferenceId = datasetId + '/' + identifier;

      var displayName = displayNameControl.vm.displayName();

      if ('gpml:' + xrefType === selectedPvjsElement['gpml:Type'] &&
        selectedPvjsElement.textContent === displayName &&
        selectedPvjsElement.entityReference === entityReferenceId) {

        // Kludge to handle cases where we change the pvjson, but the change doesn't constitute
        // a real change to the GPML, e.g., we explicitly define an implied value.
        if (!kaavio.editor.editorTabsComponent.vm.dataChanged()) {
          kaavio.editor.editorTabsComponent.vm.originalPvjsonAsString = JSON.stringify(
              kaavio.sourceData.pvjson);
        }

        // No changes.
        return;
      }

      //kaavio.editor.editorTabsComponent.vm.dataChanged(true);

      // TODO this isn't exactly matching the current pvjson model
      if (!!xrefType) {
        selectedPvjsElement['gpml:Type'] = 'gpml:' + xrefType;
      }
      if (!!displayName) {
        selectedPvjsElement.textContent = displayName;
      }
      if (!!entityReferenceId) {
        selectedPvjsElement.entityReference = entityReferenceId;
      }

      var currentXref = _.find(kaavio.sourceData.pvjson.elements,
          function(pvjsElement) {
            return pvjsElement.id === selectedPvjsElement.entityReference;
          });

      if (!currentXref && !!entityReferenceId) {
        currentXref = {};
        currentXref.id = entityReferenceId;
        kaavio.sourceData.pvjson.elements.push(currentXref);
      }

      if (!!datasetId && !!datasetName && !!identifier) {
        currentXref.isDataItemIn = {id: datasetId};
        currentXref.dbName = datasetName;
        currentXref.dbId = identifier;
        if (!!displayName) {
          currentXref.displayName = currentXref.displayName || displayName;
        }
      }

      updateDiagram(
          kaavio, selectedPvjsElement.id, xrefType, datasetName, identifier, displayName);

      //vm.reset();
    };

    //xrefSearch.vm.disabled = vm.disabled;
    annotationTab.xrefSearch.vm.init(kaavio);

    xrefTypeControl.vm.disabled = vm.disabled;
    xrefTypeControl.vm.init();

    datasetControl.vm.disabled = vm.disabled;
    datasetControl.vm.init();

    identifierControl.vm.disabled = vm.disabled;
    identifierControl.vm.init();

    displayNameControl.vm.disabled = vm.disabled;
    displayNameControl.vm.init();

    vm.onunload = function() {
      kaavio.containerElement.removeEventListener(
          'kaaviodiagramelementclick', vm.onClickDiagramContainerHandler, false);
    };

  };

  /**
   * update the dropdowns and input boxes that
   * identify and/or describe an annotationEntity.
   *
   * @param {object} selectedPvjsElement
   * @param {string} selectedPvjsElement.textContent Short name for display
   * @param {object} currentXref
   * @param {string} currentXref.type Type
   * @param {string} currentXref.displayName Short name for display
   * @param {string} currentXref.identifier Character string that differentiates this
   *                                          annotationEntity from other annotation entities.
   * @param {object} currentXref.isDataItemIn Dataset of which this annotationEntity
   *                                              reference is a member
   * @param {string} currentXref.isDataItemIn.id IRI
   * @return
   */
  vm.updateControlValues = function(selectedPvjsElement, currentXref) {
    xrefTypeControl.vm.changeXrefType(currentXref.type);
    datasetControl.vm.changeDataset(currentXref.isDataItemIn.id);
    identifierControl.vm.identifier = m.prop(currentXref.identifier);
    displayNameControl.vm.displayName = m.prop(selectedPvjsElement.textContent ||
        currentXref.displayName);
    /*
    xrefTypeControl.vm.changeXrefType(annotationEntity.type);
    datasetControl.vm.changeDataset(annotationEntity.isDataItemIn.id);
    identifierControl.vm.identifier = m.prop(annotationEntity.identifier);
    displayNameControl.vm.displayName = m.prop(annotationEntity.displayName);
    //*/
    annotationTab.vm.save();
  };

  return vm;
})();

annotationTab.controller = function() {
  annotationTab.vm.init();
};

annotationTab.view = function() {
  annotationTab.vm.disabled(!annotationTab.vm.activeSelection().id);
  return m('nav.kaavio-editor-annotation.navbar.navbar-default.navbar-form.well.well-sm', [
    m('div.navbar-left', [
      annotationTab.xrefSearch.view(),
    ]),
    m('div.form-group.navbar-left', [
      m('div.form-control[style="height: 44px;"]', {
        onchange: annotationTab.vm.save
      }, [
        xrefTypeControl.view(),
        datasetControl.view(),
        identifierControl.view(),
        displayNameControl.view(),
      ]),
    ]),
    /*
    m('div.form-group.navbar-left', [
      m('button[type="submit"][style="height: 44px;"].btn.form-control.' +
          annotationTab.vm.saveButtonClass, {
        onclick: annotationTab.vm.save
      }, [
        m('span.glyphicon.glyphicon-ok')
      ]),
    ]),
    m('span.glyphicon.glyphicon-remove.btn.navbar-right' +
        '[style="color: #aaa; transform: translateY(-10px);"]', {
      onclick: annotationTab.vm.cancel
    })
    //*/
  ]);
};

function updateDiagram(kaavio, selectedElementId, xrefType,
    datasetName, identifier, displayName) {
  if (!datasetName || !identifier) {
    throw new Error('Missing datasetName and/or identifier for updateDiagram');
  }

  if (!!selectedElementId && !!displayName) {
    var textLabelElement = kaavio.$element.select('#text-for-' + selectedElementId)
      .select('text').text(displayName);
  }
}

module.exports = annotationTab;
