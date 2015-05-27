var _ = require('lodash');
var BridgeDb = require('bridgedb');
var editorUtils = require('../../../editor-utils');
var highland = require('highland');
var m = require('mithril');
var mithrilUtils = require('../../../../mithril-utils');
var simpleModal = require('simple-modal');
var Spinner = require('spin.js');

module.exports = function(annotationTab) {

  /******************************
  * simpleModal
  *****************************/

  /** @namespace */
  var simpleModalComponent = {};

  /**
  simpleModalComponent config factory. The params in this doc refer to properties
                                        of the `ctrl` argument
  @param {Object} data - the data with which to populate the <option> list
  @param {number} value - the id of the item in `data` that we want to select
  @param {function(Object id)} onchange - the event handler to call when the selection changes.
      `id` is the the same as `value`
  */
  simpleModalComponent.config = function(ctrl) {
    m.startComputation();
    var deferred = m.deferred();
    return function(element, isInitialized) {
      var el = document.querySelector('.simple-modal-content');

      if (!isInitialized) {
        m.startComputation();
        el = simpleModal({content: 'modal content'});
        window.setTimeout(function() {
          deferred.resolve();
          //the service is done, tell Mithril that it may redraw
          m.endComputation();
        }, xrefSearch.modalOpenDelay);

        //m.module(document.querySelector('.simple-modal-content'), xrefSearchResults);
        /*
        //set up simpleModalComponent (only if not initialized already)
        el.simpleModalComponent()
          //this event handler updates the controller when the view changes
          .on('change', function(e) {
            //integrate with the auto-redrawing system...
            m.startComputation();

            //...so that Mithril autoredraws the view after calling the controller callback
            if (typeof ctrl.onchange == 'function') {
              ctrl.onchange(el.simpleModalComponent('val'));
            }

            m.endComputation();
            //end integration
            });
        //*/
      }

      return deferred.promise;

      //update the view with the latest controller value
      //xrefSelectionModal.content = 'updated modal content';
    }
  }

  simpleModalComponent.view = function(xrefList) {

    var xrefSelectionModal = document.querySelector('.simple-modal-content');

    if (!xrefSelectionModal) {
      xrefSelectionModal = simpleModal({
        title: 'Click a row to select an xref',
        content: 'modal content',
        buttons: [{
          text:'Cancel',
          closeOnClick: true,
          callback: xrefSearch.vm.reset
        }]
      });
    }

    m.render(document.querySelector('.simple-modal-content'), [
      m('table.table.table-hover.table-bordered', [
        m('thead', [
          m('tr', {}, [
            m('th', {}, 'Name'),
            m('th', {}, 'Datasource'),
            m('th', {}, 'Identifier')
          ])
        ]),
        m('tbody', {}, [
          xrefList.xrefs().map(function(xref, index) {
            return m('tr[style="cursor: pointer;"]', {onclick: function() {
              xrefSelectionModal.deconstruct();
              return xrefSearch.vm.selectXref(xref);
            }}, [
              m('td', {}, xref.displayName),
              m('td', {}, xref.db),
              m('td', {}, xref.identifier),
            ])
          })
        ])
      ])
    ]);
  };

  /******************************
   * search by name input
   *****************************/

  //module for xrefSearch
  //for simplicity, we use this module to namespace the model classes
  var xrefSearch = {};

  //the XrefList class is a list of Xrefs
  xrefSearch.XrefList = function(query) {
    this.xrefs = m.prop(xrefSearch.vm.promisifiedPrimaryFreeSearch(
          {attribute: query}));
  };

  xrefSearch.ModalList = Array;

  // how long to wait (ms) before opening modal
  xrefSearch.modalOpenDelay = 1500;

  //the view-model tracks a running list of xrefs,
  //stores a query for new xrefs before they are created
  //and takes care of the logic surrounding when searching is permitted
  //and clearing the input after searching a xref to the list
  xrefSearch.vm = (function() {
    var vm = {}

    vm.changeStateToGlyphiconMappings = {
      'true': 'btn-success',
      'false': 'btn-default'
    };

    vm.init = function(kaavio) {
      vm.spinner = kaavio.spinner;
      xrefSearch.trigger = kaavio.trigger.bind(kaavio);

      vm.disabled = annotationTab.vm.disabled;
      var bridgeDb = new BridgeDb({
        baseIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb.php/',
        datasetsMetadataIri: 'http://pointer.ucsf.edu/d3/r/data-sources/bridgedb-datasources.php',
        organism: 'Homo sapiens'
      });

      var primaryFreeSearch = function(args) {
        return bridgeDb.entityReference.freeSearch(args)
          .filter(function filter(searchResult) {
            return searchResult.isDataItemIn._isPrimary;
          });
      };

      var promisifiedPrimaryFreeSearch = highland.compose(
          mithrilUtils.promisify, primaryFreeSearch);

      vm.promisifiedPrimaryFreeSearch = promisifiedPrimaryFreeSearch;

      // list of xrefs that match the query
      vm.xrefList = m.prop([]);
      vm.modalList = new xrefSearch.ModalList();

      //a slot to store the name of a new xref before it is created
      vm.query = m.prop('');

      //react to the user selecting an xref in the modal
      vm.selectXref = function(xref) {
        xref.id = xref['@id'];
        if (!!xref.isDataItemIn) {
          xref.isDataItemIn.id = xref.isDataItemIn['@id'];
        }
        xref.type = xref['@type'];
        var foundXref = _.find(kaavio.sourceData.pvjson.elements, function(element) {
          return element.id === xref.id;
        });

        if (!foundXref) {
          kaavio.sourceData.pvjson.elements.push(xref);
        }

        var pvjsElement = kaavio.diagramComponent.vm.selection().pvjsElement();
        pvjsElement.textContent = xref.displayName;
        kaavio.diagramComponent.vm.selection().pvjsElement(pvjsElement);

        var annotationTab = kaavio.editor.editorTabsComponent.annotationTab;
        var annotationElement = new annotationTab.AnnotationElement(pvjsElement, xref);
        annotationTab.vm.updateControlValues(annotationElement);

        vm.reset();
      };

      // searches for xrefs, which are added to the list
      vm.search = function() {
        if (!_.isEmpty(vm.query())) {
          vm.modalList.push(new xrefSearch.XrefList(vm.query()));
          vm.spinner.spinDefault();
        }
      };

      vm.reset = function() {
        xrefSearch.vm.spinner.stop();
        // clears the query field for user convenience
        vm.query('');
        // TODO refactor the below line - shouldn't need to do this.
        document.querySelector('#xref-search-input').value = '';
        vm.xrefList = m.prop([]);
        vm.modalList = new xrefSearch.ModalList();
      };
    }

    return vm
  }());

  // the controller defines what part of the model is relevant for the current page
  // in our case, there's only one view-model that handles everything
  xrefSearch.controller = function() {
    xrefSearch.vm.init();
  }

  //here's the view
  xrefSearch.view = function() {
    return m('div.form-search.form-group', [
      m('div.input-group.input-group-sm.form-control', [
        m('input[placeholder="Search by name"][type="text"]', {
          'id': 'xref-search-input',
          'class': 'form-control',
          onchange: m.withAttr('value', xrefSearch.vm.query),
          value: xrefSearch.vm.query(),
          disabled: xrefSearch.vm.disabled()
        }),
        m('span.input-group-btn', {
          onclick: xrefSearch.vm.search,
          style: xrefSearch.vm.disabled() ? 'pointer-events: none; ' : null
        },
          m('button[type="submit"]', {
            'class': 'btn ' +
                xrefSearch.vm.changeStateToGlyphiconMappings[!xrefSearch.vm.disabled()]
          }, [
            m('span[aria-hidden="true"].glyphicon.glyphicon-search')
          ])),
        xrefSearch.vm.modalList.map(function(xrefList, index) {
          var xrefs = xrefList.xrefs();
          if (!!xrefs && !!xrefs.length && xrefs.length > 0) {
            xrefSearch.vm.spinner.stop();
            return simpleModalComponent.view(xrefList);
          } else {
            window.setTimeout(function() {
              xrefs = xrefList.xrefs();
              if (!_.isEmpty(xrefSearch.vm.query()) && (!xrefs || !xrefs.length)) {
                xrefSearch.trigger('warning.xrefSearch',
                    {message: 'Your search "' + xrefSearch.vm.query() +
                        '" did not match any identifiers.'});
              }
              // TODO the handling of no results returned is ugly.
              xrefSearch.vm.reset();
              return;
            }, xrefSearch.modalOpenDelay + 1500);
          }
        })
      ])
    ]);
  };

  return xrefSearch;
};
