/***********************************
 * diagramComponent
 **********************************/

var _ = require('lodash');
var DiagramRenderer = require('./diagram-renderer.js');
var EntityReference = require('../annotation-panel/entity-reference');
var JSONStream = require('JSONStream');
var m = require('mithril');
var hyperquest = require('hyperquest');
var resolveUrl = require('resolve-url');
var Rx = require('rx');
var RxNode = require('rx-node');

var diagramComponent = {};

//* TODO standardize on either this mithril-style selection.id
// or else selectedPvjsElement().id
// need to also look at whether attenuate is being called incorrectly and
// whether it conflicts with previousHighlighting() calls anywhere
diagramComponent.Selection = function(pvjsElement, highlighter) {
  var that = this;
  pvjsElement = pvjsElement || {};

  this.selector = '#' + pvjsElement.id;
  this.pvjsElement = pvjsElement;
  this.id = pvjsElement.id;

  if (!pvjsElement || !highlighter) {
    return;
  }

  //*
  var groups = highlighter.groups;

  if (!_.isEmpty(groups.preset)) {
    this.previousHighlighting = _(groups.preset).map(function(presetItem) {
      return _.zip(presetItem.element, presetItem.highlighting).map(function(zipped) {
        var element = zipped[0];
        var highlighting = zipped[1];
        return {
          element: element,
          highlighting: highlighting
        };
      })
      .filter(function(item) {
        return item.element.id === pvjsElement.id;
      })
      .map(function(item) {
        return _.bind(highlighter.highlight, highlighter,
          that.selector, 'preset', item.highlighting);
      });
    })
    .flatten()
    .first();
  }

  if (!this.previousHighlighting) {
    // if current selection exists and
    // was not highlighted as part of the preset or typeahead groups,
    // this method will allow for de-highlighting this selection
    this.previousHighlighting = _.bind(highlighter.attenuate,
        highlighter, that.selector, 'selected');
  }
  //*/
};
//*/

diagramComponent.vm = (function() {
  var vm = {};
  vm.diagramRenderer = new DiagramRenderer();

  vm.init = function(kaavio) {

    var jsonldRx = kaavio.jsonldRx;

    var selection = new diagramComponent.Selection();

    vm.clickTargetIdSource = new Rx.Subject();

    var clickTargetIdHierarchy = jsonldRx.hierarchicalPartition(
        vm.clickTargetIdSource,
        function(id) {
          return id;
        }
    );

    var selectionHierarchy = vm.selectionHierarchy = jsonldRx.hierarchicalPartition(
        clickTargetIdHierarchy.mainSource
          .flatMap(function(id) {
            // TODO look at using the code from selector.js here instead
            return Rx.Observable.from(kaavio.sourceData.pvjson.elements)
              .find(function(pvjsElement, i, obs) {
                return pvjsElement.id === id;
              });
          }),
        function(pvjsElement) {
          return pvjsElement;
        },
        clickTargetIdHierarchy.resetSource
    );

    vm.pvjsElementSource = selectionHierarchy.mainSource;
    vm.resetSource = selectionHierarchy.resetSource;

    vm.pvjsElementSource.subscribe(function(pvjsElement) {
      // clear away any highlighting for previously selected element
      vm.reset();
      // highlight currently selected element
      kaavio.highlighter.highlight('#' + pvjsElement.id, 'selected', {
        backgroundColor: 'white', borderColor: 'green'
      });

      // TODO should creating a new selection remove old highlighting and
      // add new highlighting?
      selection = new diagramComponent.Selection(pvjsElement, kaavio.highlighter);
    });

    vm.resetSource.subscribe(function() {
      vm.reset();
    });

    kaavio.annotationPanel = {};
    kaavio.annotationPanel.vm = {};
    kaavio.annotationPanel.vm.disabled = m.prop(false);

    kaavio.diagramComponent = diagramComponent;
    // Listen for renderer errors
    kaavio.on('error.renderer', function() {
      vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
    });

    kaavio.on('rendered.renderer', function() {

      /*
      var myinput = {
        mykey: 'myvalue'
      };

      var myWorker = new Worker('my_task.js');

      myWorker.onmessage = function(oEvent) {
        console.log('myinput2');
        console.log(myinput);
        var data = oEvent.data;
        console.log('Worker said : ');
        console.log(data);
        console.log('myinput3');
        console.log(myinput);
        window.newerinput = _.assign(myinput, data);
      };

      myWorker.postMessage(myinput);
      console.log('myinput1');
      console.log(myinput);

      window.oldinput = _.clone(myinput)
      window.newinput = myinput;
      //*/

      //*
      Rx.Observable.from(kaavio.sourceData.pvjson.elements)
        .filter(function(element) {
          return element.bridgeDbDatasourceName && element.identifier;
        })
        .flatMap(function(element) {
          return Rx.Observable.fromPromise(element.getSetEntityReference());
        })
        .filter(function(entityReference) {
          return entityReference;
        })
        .map(function(entityReference) {
          return kaavio.sourceData.selector.addElement(entityReference);
        })
        .toArray()
        .subscribe(function(selectors) {
          // do something
        }, function(err) {
          throw err;
        });
      //*/

      //*
      var entityReferenceAnnotationPanel = new EntityReference(kaavio);
      // Search for reference id on demand
      /*
      Rx.Observable.if(
          function() {
            console.log('!kaavio.annotationPanel.vm.disabled()');
            console.log(!kaavio.annotationPanel.vm.disabled());
            return !kaavio.annotationPanel.vm.disabled();
            //return true;
            //return false;
          },
          vm.pvjsElementSource
      )
      //*/
      vm.pvjsElementSource
        // TODO this seems like the wrong way to disable the annotation panel
        // when the editor is open.
        .filter(function(pvjsElement) {
          return !kaavio.annotationPanel.vm.disabled();
        })
        .filter(function(pvjsElement) {
          return pvjsElement.bridgeDbDatasourceName && pvjsElement.identifier;
        })
        .flatMap(function(pvjsElement) {
          return Rx.Observable.zipArray(
              Rx.Observable.return(pvjsElement),
              Rx.Observable.fromPromise(pvjsElement.getSetEntityReference())
          );
        })
        .subscribe(function(pvjsElementAndEntityReference) {
          var pvjsElement = pvjsElementAndEntityReference[0];
          var entityReference = pvjsElementAndEntityReference[1];

          var entityReferenceId = pvjsElement.entityReference;
          // Get all xrefs with given id
          var selector = kaavio.sourceData.selector.filteredByXRef(
              'id:' + entityReferenceId).getFirst();
          // If any xref found
          if (!selector.isEmpty()) {
            // If first element has xrefs field
            if (selector[0].xrefs && selector[0].xrefs.length) {
              // Filter only bridgebd xrefs
              var filtered = selector[0].xrefs.filter(function(xref) {
                return xref.indexOf('bridgedb.org' !== -1)
              })

              // If at least one xref left
              if (filtered.length) {
                entityReferenceId = filtered[0]
              }
            }
          }

          entityReferenceAnnotationPanel.render({
            metadata: {
              label: pvjsElement.textContent,
              description: (pvjsElement.type || '')
                             .replace('biopax:', '')
                             .replace('gpml:', '')
            },
            entityReference: entityReference
          });
        }, function(err) {
          throw err;
        });
      //*/

      /* TODO delete the section below once we've tested that the section above works correctly.
      if (!!entityReference && pvjsElement.type !== void 0) {
        // right now, pathways generally don't have a shape,
        // so they are being handled by attaching events to their text.

        // Add class to change mouse hover
        $node.classed({'has-xref': true});

        var notDragged = true;

        //*
        $node.on('mousedown', function(d, i) {
          notDragged = true;
        })
        .on('mousemove', function(d, i) {
          notDragged = false;
        })
        .on('mouseup', function(d, i) {
          if (notDragged && !renderer.kaavio.annotationPanel.vm.disabled()) {
            // Search for reference id on demand

            var referenceId = entityReference

            // If BridgeDB handles pathway entities of this type
            // TODO check whether this matches our current pvjson
            if (['Protein', 'Dna', 'Rna', 'SmallMolecule', 'Metabolite'].indexOf(
                pvjsElement.type) !== -1) {
              // Get all xrefs with given id
              var selector = renderer.kaavio.sourceData.selector.filteredByXRef(
                  'id:' + entityReference).getFirst()
              // If any xref found
              if (!selector.isEmpty()) {
                // If first element has xrefs field
                if (selector[0].xrefs && selector[0].xrefs.length) {
                  // Filter only bridgebd xrefs
                  var filtered = selector[0].xrefs.filter(function(xref) {
                    return xref.indexOf('bridgedb.org' !== -1)
                  })

                  // If at least one xref left
                  if (filtered.length) {
                    referenceId = filtered[0]
                  }
                }
              }
            }

            EntityReference.render(renderer.kaavio, {
              metadata: {
                label: pvjsElement.textContent,
                description: pvjsElement.type
                               .replace('biopax:', '')
                               .replace('gpml:', '')
              },
              entityReference: {
                id: referenceId
              }
            });
          } // end of if notDragged
        });
      }
      //*/
    });

    vm.footerState = kaavio.kaavioComponent.vm.state.footer;

    vm.destroy = function() {
      vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
    };

    vm.onunload = function() {
      vm.reset();
      return;
    };

    vm.reset = function() {
      document.querySelector('.annotation').style.visibility = 'hidden';

      if (!!selection.previousHighlighting) {
        // return highlighting to previous state, if it exists
        selection.previousHighlighting();
      }
      selection = new diagramComponent.Selection();
    };
  };

  return vm;
})();

diagramComponent.controller = function(ctrl) {
  diagramComponent.vm.init(ctrl);
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

function getEvent(e) {
  e = e || event;
  return e;
}

function getVmPropName(e, elPropName, vmPropName) {
  if (!vmPropName) {
    // e.g., clickTargetIdSource or keyupTargetTagNameSource
    vmPropName = e.type + 'Target' + elPropName.replace(/(^.)/, function(match) {
      return match.toUpperCase();
    }) + 'Source';
  }
  return vmPropName;
}

function getElPropValue(el, elPropName) {
  return elPropName in el ? el[elPropName] : el.getAttribute(elPropName);
}

function getCurrentTarget(e) {
  e = getEvent(e);
  var currentTarget = e.currentTarget || this;
  return currentTarget;
}

function getTarget(e) {
  e = getEvent(e);
  var target = e.target;
  return target;
}

function rxPushEvent(e, eventName) {
  var vm = this;
  e = getEvent(e);
  if (!eventName) {
    eventName = e.type + 'Source';
  }
  vm[eventName].onNext(e);
}

// gets attribute of the element to which the
// event was added
function rxWithAttr(elPropName, vmPropName) {
  var vm = this;
  return _.flow(getEvent.bind(this),
      function(e) {
        vmPropName = getVmPropName(e, elPropName, vmPropName);
        var currentTarget = getCurrentTarget.bind(this)(e);
        var elPropValue = getElPropValue(currentTarget, elPropName);
        vm[vmPropName].onNext(elPropValue);
      });
}

// gets attribute of the element upon which the event
// actually occurred
function rxWithTargetAttr(elPropName, vmPropName) {
  var vm = this;
  return _.flow(getEvent,
      function(e) {
        vmPropName = getVmPropName(e, elPropName, vmPropName);
        var target = e.target;
        var elPropValue = getElPropValue(target, elPropName);
        vm[vmPropName].onNext(elPropValue);
      });
}

diagramComponent.view = function(ctrl, kaavio) {
  var component = this;
  var vm = component.vm;
  /*
  return renderOnce(function() {
  });
  //*/
  return m('div', {
    'class': 'diagram-container footer-' + diagramComponent.vm.footerState(),
    onclick: rxWithTargetAttr.call(vm, 'id'),
    config: function(el, isInitialized) {
      if (!isInitialized) {
        m.startComputation();
        kaavio.on('rendered.renderer', function() {
          m.endComputation();
        });

        kaavio.diagramContainerElement = el;

        // Init sourceData object
        kaavio.sourceData = {
          pvjson: null, // pvjson object
          selector: null, // selector instance
        };

        Rx.Observable.from([kaavio.options]).flatMap(function(options) {
          var pvjson = options.pvjson;
          var src = options.src;

          if (!!pvjson) {
            return Rx.Observable.from([pvjson]);
          } else if (!!src) {
            var absoluteSrc = resolveUrl(src);
            return RxNode.fromReadableStream(hyperquest(absoluteSrc)
              .pipe(JSONStream.parse()))
              .toArray()
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
        .subscribe(function(pvjson) {
          kaavio.sourceData.pvjson = pvjson;
          diagramComponent.vm.diagramRenderer.render(kaavio);
        }, function(err) {
          // TODO handle this
          throw err;
        }, function() {
          // onComplete
        });

      }
    }
  });
};

module.exports = diagramComponent;
