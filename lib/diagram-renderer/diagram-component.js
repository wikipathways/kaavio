/***********************************
 * diagramComponent
 **********************************/

var _ = require('lodash');
var DiagramRenderer = require('./diagram-renderer.js');
var highland = require('highland');
var Highlighter = require('../highlighter/highlighter.js');
var JSONStream = require('JSONStream');
var m = require('mithril');
var request = require('request');
var resolveUrl = require('resolve-url');

function DiagramComponent(kaavio) {
  var diagramComponent = {};

  diagramComponent.vm = (function() {
    var vm = {};
    vm.init = function() {
      vm.diagramRenderer = new DiagramRenderer();
      vm.footerState = m.route.param('editorState');

      vm.selectedPvjsElement = m.prop();

      // Listen for renderer errors
      kaavio.on('error.renderer', function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      });

      kaavio.on('rendered', function() {
        kaavio.highlighter = new Highlighter(
          kaavio, kaavio.options);

        var highlightEntitiesList = kaavio.options.highlight;

        if (!!highlightEntitiesList && highlightEntitiesList.length !== 0) {
          highlightEntitiesList.map(function(entity) {
            var selector = entity.selector;
            var selectorMatch = selector.match(/xref:id:(.*)\,(.*)/);
            if (selectorMatch) {
              var dbName = selectorMatch[2];
              var dbId = selectorMatch[1];
              var entityReferenceId = kaavio.sourceData.pvjson.elements
              /*
              .filter(function(element) {
                return !!element.isDataItemIn;
              })
              .filter(function(element) {
                return element.isDataItemIn.dbName === dbName && element.isDataItemIn.dbId === dbId;
              })
              //*/
              /*
              .filter(function(element) {
                return element.dbName === dbName && element.dbId === dbId;
              })
              //*/
              .filter(function(element) {
                var iriRegex = new RegExp('^http:\/\/.*' + dbId + '.*')
                return element.id && iriRegex.test(element.id);
              })
              .map(function(entity) {
                //return entity['@id'];
                return entity.id;
              })[0];
              entity.selector = 'xref:id:' + entityReferenceId;
            }

            return entity;
          }).forEach(function(entity) {
            kaavio.highlighter.highlight(entity.selector, null, entity);
          });

        }
      });

      vm.destroy = function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      };

      /***********************************************
       * DataNode onclick event handler
       **********************************************/
      vm.onClickHandler = function(e) {
        var selectedElementId = e.target.id;

        if (!selectedElementId) {
          //return vm.init(kaavio);
          vm.selectedPvjsElement(null);
          return;
        }

        // de-highlight previous selection, if it exists
        if (!!vm.selectedPvjsElement()) {
          kaavio.highlighter.attenuate(
              '#' + vm.selectedPvjsElement().id);
        }

        vm.selectedPvjsElement(kaavio.sourceData.pvjson.elements.filter(
                function(pvjsElement) {
              return pvjsElement.id === selectedElementId;
            })
            .map(function(pvjsElement) {
              return pvjsElement;
            })[0]);

        /*
        if (!vm.selectedPvjsElement()) {
          return vm.init(kaavio);
        }
        //*/

        if (!!vm.selectedPvjsElement()) {
          kaavio.highlighter.highlight('#' + selectedElementId, null, {
            backgroundColor: 'white', borderColor: 'green'
          });
        }

        var kaaviodiagramelementclickEvent = new CustomEvent('kaaviodiagramelementclick', {
          detail: {
            selectedPvjsElement: vm.selectedPvjsElement()
          }
        });
        kaavio.containerElement.dispatchEvent(kaaviodiagramelementclickEvent);
      }

      vm.clearSelection = function clearSelection() {
        if (vm.selectedPvjsElement()) {
          kaavio.highlighter.attenuate(
              '#' + vm.selectedPvjsElement.id);
        }

        vm.selectedPvjsElement(null);
      }

      vm.onunload = function() {
        return;
      };

      vm.reset = function() {
      };
    };

    return vm;
  })();

  diagramComponent.controller = function() {
    diagramComponent.vm.init();
  };

  /*
  //here's an example plugin that determines whether data has changes.
  //in this case, it simply assumes data has changed the first time, and never changes after that.
  var renderOnce = (function() {
    var cache = {};
    return function(view) {
      if (!cache[view.toString()]) {
        cache[view.toString()] = true;
        return view(cache);
      } else {
        return {subtree: 'retain'};
      }
    };
  }());
  //*/

  diagramComponent.view = function() {
    //return renderOnce(function() {
    return m('div', {
      'class': 'diagram-container footer-' + diagramComponent.vm.footerState,
      onclick: diagramComponent.vm.onClickHandler,
      config: function(el, isInitialized) {
        if (!isInitialized) {
          //integrate with the auto-redrawing system...
          //m.startComputation();

          kaavio.diagramContainerElement = el;

          // Init sourceData object
          kaavio.sourceData = {
            pvjson: null, // pvjson object
            selector: null, // selector instance
          };

          highland([kaavio.options]).flatMap(function(options) {
            var pvjson = options.pvjson;
            var src = options.src;

            if (!!pvjson) {
              return highland([pvjson]);
            } else if (!!src) {
              var absoluteSrc = resolveUrl(src);
              return highland(request(absoluteSrc))
              .through(JSONStream.parse())
              .collect()
              .map(function(body) {
                return body[0];
              });
            } else {
              throw new Error('Missing or invalid source pvjson data. The input options ' +
                  'require either a "src" property with a string value representing ' +
                  'an IRI to a pvjson JSON resource ' +
                  'or a "pvjson" property with a parsed JavaScript object representing a ' +
                  'pvjson JSON resource.')
            }
          })
          .errors(function(err, push) {
            throw err;
          })
          .each(function(pvjson) {
            kaavio.sourceData.pvjson = pvjson;
            diagramComponent.vm.diagramRenderer.render(kaavio);
          });

          /*
          kaavio.on('rendered', function() {
            //kaavio.panZoom.resizeDiagram();
            kaavio.highlighter = new Highlighter(
              kaavio, kaavio.options);
            //m.endComputation();
          });
          //*/
        }
      }
    });
    //});
  };

  return diagramComponent;
}

module.exports = DiagramComponent;
