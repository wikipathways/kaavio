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
var xrefSearch;

annotationTab.ItemList = Array;

annotationTab.Item = function(item) {
  this.id = m.prop(item.id);
  this.name = m.prop(item.name);
};

annotationTab.vm = (function() {

  // This is the entity that the selectedPvjsElement may reference
  // as its entityReference.
  var currentXref;

  var vm = {};

  vm.init = function(pvjs) {

    annotationTab.vm.saveButtonClass = 'btn-default';

    xrefSearch = new XrefSearch(annotationTab);

    vm.cancel = function() {
      vm.reset();
      pvjs.editor.cancel();
    };

    vm.onClickDiagramContainer = function(selectedPvjsElement) {

      // TODO this is a kludge. refactor.
      annotationTab.vm.saveButtonClass = 'btn-success';

      currentXref = _.find(pvjs.sourceData.pvjson.elements,
          function(pvjsElement) {
            return pvjsElement.id === selectedPvjsElement.entityReference;
          });

      if (!currentXref) {
        return;
      }

      var iri = selectedPvjsElement.entityReference;
      var iriComponents = iri.split('identifiers.org');
      var iriPath = iriComponents[iriComponents.length - 1];
      var iriPathComponents = iriPath.split('/');
      var preferredPrefix = iriPathComponents[1];
      var identifier = iriPathComponents[2];

      var datasetId = 'http://identifiers.org/' + preferredPrefix;
      currentXref.isDataItemIn = {id: datasetId};

      currentXref.identifier = identifier;

      var entity = editorUtils.convertXrefToPvjsEntity(currentXref);
      annotationTab.vm.updateControlValues(entity);
    };

    vm.reset = function() {
      annotationTab.vm.saveButtonClass = 'btn-default';
      xrefTypeControl.vm.init();
      datasetControl.vm.currentDataset.id = m.prop('');
      identifierControl.vm.identifier = m.prop('');
      displayNameControl.vm.displayName = m.prop('');

      pvjs.editor.clearSelection();
    };

    vm.save = function() {
      annotationTab.vm.saveButtonClass = 'btn-default';
      var xrefType = xrefTypeControl.vm.currentXrefType.name();
      var datasetName = datasetControl.vm.currentDataset.name();
      var datasetId = datasetControl.vm.currentDataset.id();
      var identifier = identifierControl.vm.identifier();
      var displayName = displayNameControl.vm.displayName();
      var entityReferenceId = datasetId + '/' + identifier;

      var selectedPvjsElement = pvjs.editor.selectedPvjsElement;
      // TODO this isn't exactly matching the current pvjson model
      selectedPvjsElement['gpml:Type'] = 'gpml:' + xrefType;
      selectedPvjsElement.textContent = displayName;
      selectedPvjsElement.entityReference = entityReferenceId;

      currentXref = _.find(pvjs.sourceData.pvjson.elements,
          function(pvjsElement) {
            return pvjsElement.id === selectedPvjsElement.entityReference;
          });

      if (!currentXref) {
        currentXref = {};
        currentXref.id = entityReferenceId;
        pvjs.sourceData.pvjson.elements.push(currentXref);
      }

      currentXref.isDataItemIn = {id: datasetId};
      currentXref.dbName = datasetName;
      currentXref.dbId = identifier;
      currentXref.displayName = currentXref.displayName || displayName;

      updateDiagram(
          pvjs, selectedPvjsElement.id, xrefType, datasetName, identifier, displayName);

      vm.reset();
    };

    xrefSearch.vm.init();
    xrefTypeControl.vm.init();
    datasetControl.vm.init();
    identifierControl.vm.init();
    displayNameControl.vm.init();
  };

  /**
   * update the dropdowns and input boxes that
   * identify and/or describe an entity.
   *
   * @param {object} entity
   * @param {string} entity.type Type
   * @param {string} entity.displayName Short name for display
   * @param {string} entity.identifier Character string that differentiates this
   *                                          entity from other entitys.
   * @param {object} entity.isDataItemIn Dataset of which this entity
   *                                              reference is a member
   * @param {string} entity.isDataItemIn.id IRI
   * @param {string} entity.isDataItemIn.displayName Short name for display
   * @return
   */
  vm.updateControlValues = function(entity) {
    xrefTypeControl.vm.changeXrefType(entity.type);
    datasetControl.vm.changeDataset(entity.isDataItemIn.id);
    identifierControl.vm.identifier = m.prop(entity.identifier);
    displayNameControl.vm.displayName = m.prop(entity.displayName);
  };

  return vm;
})();

annotationTab.controller = function() {
  annotationTab.vm.init();
};

annotationTab.view = function() {
  return m('nav.pvjs-editor-annotation.navbar.navbar-default.navbar-form.well.well-sm', [
    m('div.navbar-left', [
      xrefSearch.view(),
    ]),
    m('div.form-group.navbar-left', [
      m('div.form-control[style="height: 44px;"]', [
        xrefTypeControl.view(),
        datasetControl.view(),
        identifierControl.view(),
        displayNameControl.view(),
      ]),
    ]),
    m('div.form-group.navbar-left', [
      m('button[type="submit"][style="height: 44px;"].btn.form-control.' +
          annotationTab.vm.saveButtonClass, {
        onclick: annotationTab.vm.save
      }, [
        m('span.glyphicon.glyphicon-ok')
      ]),
    ]),
    /*
    m('span.glyphicon.glyphicon-remove.btn.navbar-right' +
        '[style="color: #aaa; transform: translateY(-10px);"]', {
      onclick: annotationTab.vm.cancel
    })
    //*/
  ]);
};

function updateDiagram(pvjs, selectedElementId, xrefType,
    datasetName, identifier, displayName) {
  if (!datasetName || !identifier) {
    throw new Error('Missing datasetName and/or identifier for updateDiagram');
  }

  var textLabelElement = pvjs.$element.select('#text-for-' + selectedElementId)
    .select('text').text(displayName);
}

module.exports = annotationTab;
