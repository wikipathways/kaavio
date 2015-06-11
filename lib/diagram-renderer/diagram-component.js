/***********************************
 * diagramComponent
 **********************************/

var _ = require('lodash');
var DiagramRenderer = require('./diagram-renderer.js');
var highland = require('highland');
var JSONStream = require('JSONStream');
var m = require('mithril');
var hyperquest = require('hyperquest');
var resolveUrl = require('resolve-url');
var Rx = require('rx');

function DiagramComponent(kaavio) {
  var diagramComponent = {};

  //* TODO standardize on either this mithril-style selection().id()
  // or else selectedPvjsElement().id
  // need to also look at whether attenuate is being called incorrectly and
  // whether it conflicts with previousHighlighting() calls anywhere
  diagramComponent.Selection = function(pvjsElement) {
    var that = this;
    pvjsElement = pvjsElement || {};

    this.selector = m.prop('#' + pvjsElement.id);
    this.pvjsElement = m.prop(pvjsElement);
    this.id = m.prop(pvjsElement.id);

    if (!pvjsElement || !kaavio.highlighter) {
      return;
    }

    var groups = kaavio.highlighter.groups;

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
        /*
        .map(function(item) {
          return _.partial(kaavio.highlighter.highlight,
              that.selector(), 'preset', item.highlighting);
        });
        //*/
        //*
        .map(function(item) {
          return _.bind(kaavio.highlighter.highlight, kaavio.highlighter,
            that.selector(), 'preset', item.highlighting);
        });
        //*/
      })
      .flatten()
      .first();
    }

    if (!this.previousHighlighting) {
      // if current selection exists and
      // was not highlighted as part of the preset or typeahead groups,
      // this method will allows for de-highlighting this selection
      this.previousHighlighting = _.bind(kaavio.highlighter.attenuate,
          kaavio.highlighter, that.selector(), 'selected');
    }
  };
  //*/

  diagramComponent.vm = (function() {
    var vm = {};
    vm.init = function() {
      vm.diagramRenderer = new DiagramRenderer();
      //vm.footerState = m.route.param('editorState');
      //vm.footerState = kaavio.options.footer;
      vm.footerState = kaavio.kaavioComponent.vm.state.footer;

      vm.selection = m.prop(new diagramComponent.Selection());

      // Listen for renderer errors
      kaavio.on('error.renderer', function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      });

      vm.destroy = function() {
        vm.diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
      };

      window.Rx = Rx;

      vm.clickTargetIdSource = new Rx.Subject();
      vm.clickTargetTagNameSource = new Rx.Subject();

      var nonNullClickTargetIdAndResetSource = vm.clickTargetIdSource
        .partition(function(id) {
          return !!id;
        });

      var nonNullClickTargetIdSource = nonNullClickTargetIdAndResetSource[0];
      var nullClickTargetIdSource = nonNullClickTargetIdAndResetSource[1];

      var pvjsElementAndResetSource = nonNullClickTargetIdSource
        .selectMany(function(id) {
          return Rx.Observable.from(kaavio.sourceData.pvjson.elements)
            .find(function(pvjsElement, i, obs) {
              return pvjsElement.id === id;
            });
        })
        .partition(function(pvjsElement) {
          return !!pvjsElement;
        });

      vm.selectionSource = pvjsElementAndResetSource[0]
        .map(function(pvjsElement) {
          // clear away any highlighting for previously selected element
          vm.reset();
          // highlight currently selected element
          kaavio.highlighter.highlight('#' + pvjsElement.id, 'selected', {
            backgroundColor: 'white', borderColor: 'green'
          });

          // TODO should creating a new selection remove old highlighting and
          // add new highlighting?
          vm.selection(new diagramComponent.Selection(pvjsElement));

          return vm.selection;
        });

      vm.resetSource = nullClickTargetIdSource.merge(pvjsElementAndResetSource[1]);

      vm.selectionSource.subscribe(function(selection) {
        // do something
      });

      vm.resetSource.subscribe(function() {
        vm.reset();
      });

      vm.clickTargetId = m.prop('None');
      vm.clickTargetIdSource.subscribe(
          function(x) {
            vm.clickTargetId(x);
          },
          function(err) {
            throw err;
          },
          function() {
            // do something
          });

      vm.onunload = function() {
        vm.reset();
        return;
      };

      vm.reset = function() {
        if (!!vm.selection().previousHighlighting) {
          // return highlighting to previous state, if it exists
          vm.selection().previousHighlighting();
        }
        vm.selection(new diagramComponent.Selection());
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

  diagramComponent.view = function() {
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
              return highland(hyperquest(absoluteSrc))
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
        }
      }
    });
  };

  return diagramComponent;
}

module.exports = DiagramComponent;
