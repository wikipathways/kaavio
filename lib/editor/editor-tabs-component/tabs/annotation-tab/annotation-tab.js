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
var Rx = require('rx');

var annotationTab = {};

annotationTab.ItemList = Array;

annotationTab.Item = function(item) {
  this.id = m.prop(item.id);
  this.name = m.prop(item.name);
};

annotationTab.AnnotationElement = function(pvjsElement, xref) {
  this.datasetId = xref.isDataItemIn.id,
  this.type = xref.type,
  this.identifier = xref.identifier,
  this.textContent = pvjsElement.textContent || xref.displayName
};

annotationTab.vm = (function() {

  var vm = {};

  vm.init = function(kaavio) {
    kaavio.editor.editorTabsComponent.annotationTab = annotationTab;
    vm.xref = m.prop();
    vm.disabled = m.prop(true);
    vm.selection = kaavio.editor.vm.selection;

    var xrefSearch = annotationTab.xrefSearch = new XrefSearch(annotationTab);

    vm.cancel = function() {
      vm.reset();
      kaavio.editor.cancel();
    };

    var currentXrefAndResetSource = kaavio.editor.vm.selectionSource
      .map(function(selection) {
        var pvjsElement = selection().pvjsElement();
        var currentXref = _.find(kaavio.sourceData.pvjson.elements,
            function(element) {
              return element.id === pvjsElement.entityReference;
            });
        return currentXref;
      })
      .partition(function(currentXref) {
        return !_.isEmpty(currentXref);
      });

    var currentXrefSource = currentXrefAndResetSource[0];
    vm.resetSource = kaavio.editor.vm.resetSource.merge(currentXrefAndResetSource[1]);

    vm.annotationElementSource = currentXrefSource.map(function(currentXref) {
        vm.disabled(false);
        vm.xref(currentXref);

        var pvjsElement = vm.selection().pvjsElement();
        var iri = pvjsElement.entityReference;
        var iriComponents = iri.split('identifiers.org');
        var iriPath = iriComponents[iriComponents.length - 1];
        var iriPathComponents = iriPath.split('/');
        var preferredPrefix = iriPathComponents[1];
        var identifier = iriPathComponents[2];

        var datasetId = 'http://identifiers.org/' + preferredPrefix;
        currentXref.isDataItemIn = {id: datasetId};

        currentXref.identifier = identifier;

        // Kludge to handle cases where we change the pvjson, but the change doesn't constitute
        // a real change to the GPML, e.g., we explicitly define an implied value.
        if (!kaavio.editor.editorTabsComponent.vm.dataChanged()) {
          kaavio.editor.editorTabsComponent.vm.originalPvjsonAsString = JSON.stringify(
              kaavio.sourceData.pvjson);
        }

        var annotationElement = new annotationTab.AnnotationElement(pvjsElement, currentXref);

        return annotationElement;
      });

    vm.resetSource
      .subscribe(function(value) {
        vm.reset();
      }, function(err) {
        console.log(err);
      }, function(value) {
        console.log(value);
      });

    vm.annotationElementSource.subscribe(function(annotationElement) {
      // TODO we want to edit the actual instance, not the EntityReference,
      // but right now, we're getting the displayName from the EntityReference,
      // not the textContent from the instance.
      // annotationEntity is a combination of an Xref plus the displayName of
      // the selection, which may differ from the displayName of the
      // referenced Xref.
      //var annotationEntity = editorUtils.createAnnotationEntity(
      //    currentXref, pvjsElement);
      //annotationTab.vm.updateControlValues(annotationEntity);
      vm.updateControlValues(annotationElement);
    });

    vm.reset = function() {
      //annotationTab.vm.saveButtonClass = 'btn-default';
      xrefTypeControl.vm.init();
      datasetControl.vm.currentDataset.id = m.prop('');
      identifierControl.vm.identifier = m.prop('');
      displayNameControl.vm.reset();
      vm.disabled(true);
    };

    vm.save = function() {
      var pvjsElement = _.find(kaavio.sourceData.pvjson.elements, function(element) {
        return kaavio.diagramComponent.vm.selection().id() === element.id;
      });
      if (!pvjsElement) {
        return console.warn('No pvjsElement. Cannot save.');
      }

      //annotationTab.vm.saveButtonClass = 'btn-default';
      var xrefType = xrefTypeControl.vm.currentXrefType.name().replace(' ', '');

      var datasetName = datasetControl.vm.currentDataset.name();
      var datasetId = datasetControl.vm.currentDataset.id();
      var identifier = identifierControl.vm.identifier();
      var entityReferenceId = datasetId + '/' + identifier;

      var displayName = displayNameControl.vm.displayName();

      if ('gpml:' + xrefType === pvjsElement['gpml:Type'] &&
        pvjsElement.textContent === displayName &&
        pvjsElement.entityReference === entityReferenceId) {

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
        pvjsElement['gpml:Type'] = 'gpml:' + xrefType;
      }
      if (!!displayName) {
        pvjsElement.textContent = displayName;
      }
      if (!!entityReferenceId) {
        pvjsElement.entityReference = entityReferenceId;
      }

      var currentXref = _.find(kaavio.sourceData.pvjson.elements,
          function(element) {
            return element.id === pvjsElement.entityReference;
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
          kaavio, pvjsElement.id, xrefType, datasetName, identifier, displayName);

      //vm.reset();
    };

    xrefSearch.vm.disabled = vm.disabled;
    annotationTab.xrefSearch.vm.init(kaavio);

    xrefTypeControl.vm.disabled = vm.disabled;
    xrefTypeControl.vm.init(kaavio);

    datasetControl.vm.disabled = vm.disabled;
    datasetControl.vm.init(kaavio);

    identifierControl.vm.disabled = vm.disabled;
    identifierControl.vm.init(kaavio);

    displayNameControl.vm.disabled = vm.disabled;
    displayNameControl.vm.init(kaavio);

    vm.onunload = function() {
    };

  };

  /**
   * update the dropdowns and input boxes that
   * identify and/or describe an annotationEntity.
   *
   * @param {object} pvjsElement
   * @param {string} pvjsElement.textContent Short name for display
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
  vm.updateControlValues = function(annotationElement) {
    xrefTypeControl.vm.changeXrefType(annotationElement.type);
    datasetControl.vm.changeDataset(annotationElement.datasetId);
    identifierControl.vm.identifier = m.prop(annotationElement.identifier);
    displayNameControl.vm.displayName = m.prop(annotationElement.textContent);
    annotationTab.vm.save();
  };

  return vm;
})();

annotationTab.controller = function() {
  annotationTab.vm.init();
};

annotationTab.view = function() {
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
  ]);
};

function updateDiagram(kaavio, selectionId, xrefType,
    datasetName, identifier, displayName) {
  if (!datasetName || !identifier) {
    throw new Error('Missing datasetName and/or identifier for updateDiagram');
  }

  if (!!selectionId && !!displayName) {
    var textLabelElement = kaavio.$element.select('#text-for-' + selectionId)
      .select('text').text(displayName);
  }
}

module.exports = annotationTab;
