/***********************************
 * diagramComponent
 **********************************/

var DiagramRenderer = require('./diagram-renderer.js');
var KaavioHighlighter = require('../highlighter/highlighter.js');
var m = require('mithril');
var request = require('request');
var resolveUrl = require('resolve-url');

function DiagramComponent(privateInstance) {
  var diagramComponent = {};

  diagramComponent.vm = (function() {
    var vm = {};
    vm.init = function() {
      vm.diagramRenderer = new DiagramRenderer();

      // Listen for renderer errors
      privateInstance.on('error.renderer', function() {
        vm.diagramRenderer.destroyRender(privateInstance, privateInstance.sourceData);
      });

      vm.destroy = function() {
        vm.diagramRenderer.destroyRender(privateInstance, privateInstance.sourceData);
      };

      vm.onClickHandler = function(el) {
        if (!!el) {
          console.log('el');
          console.log(el);
        }
      };

      vm.onunload = function() {
        console.log('diagramComponent unloaded');
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

  diagramComponent.view = function(footerState) {
    return m('div.diagram-container.footer-' + footerState, {
      config: function(el, isInitialized) {
        if (!isInitialized) {
          //integrate with the auto-redrawing system...
          m.startComputation();

          // Init sourceData object
          privateInstance.sourceData = {
            pvjson: null, // pvjson object
            selector: null, // selector instance
          };

          var pvjson = privateInstance.options.pvjson;
          var src = privateInstance.options.src;

          if (!!pvjson) {
            privateInstance.sourceData.pvjson = pvjson;
            diagramComponent.vm.diagramRenderer.render(privateInstance);
          } else if (!!src) {
            var absoluteSrc = resolveUrl(src);
            request(absoluteSrc, function(err, response, body) {
              if (err) {
                throw err;
              }
              if (response.statusCode !== 200) {
                throw new Error('Bad response status code: ' + response.statusCode)
              }
              privateInstance.sourceData.pvjson = JSON.parse(body);
              diagramComponent.vm.diagramRenderer.render(privateInstance);
            });
          } else {
            throw new Error('Missing or invalid source pvjson data. The input options ' +
                'require either a "src" property with a string value representing ' +
                'an IRI to a pvjson JSON resource ' +
                'or a "pvjson" property with a parsed JavaScript object representing a ' +
                'pvjson JSON resource.')
          }

          //
          privateInstance.on('rendered', function() {
            privateInstance.highlighter = new KaavioHighlighter(
              privateInstance, privateInstance.options);
            m.endComputation();
          });
        }
      }
    });
  };

  return diagramComponent;
}

module.exports = DiagramComponent;
