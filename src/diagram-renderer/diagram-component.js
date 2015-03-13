/***********************************
 * diagramComponent
 **********************************/

var m = require('mithril');

function DiagramComponent(internalInstance) {
  var isInitializedHere = false;
  var diagramComponent = {};

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

  diagramComponent.vm = (function() {
    var vm = {};
    vm.init = function() {

      vm.color = m.prop('');

      vm.onClickHandler = function(el) {
        if (!!el) {
          console.log('el');
          console.log(el);
        }
      };

      // react to user updating color value
      vm.updateColor = function(newColor) {
        if (!!newColor) {
          vm.color(newColor);
        }
      };

      vm.reset = function() {
        vm.color('');
      };
    };

    return vm;
  })();

  diagramComponent.controller = function() {
    diagramComponent.vm.init();
  };

  /*
  diagramContainerElement.setAttribute(
      'style', 'height: ' + (internalInstance.elementHeight - 120) + 'px;');
  internalInstance.panZoom.resizeDiagram();
  //*/

  //this view implements a color-picker input for both
  //browers that support it natively and those that don't
  diagramComponent.view = renderOnce(function(cache) {
    return m('div', {
      //*
      config: function(el, isInitialized) {
        if (!isInitializedHere && !isInitialized) {
          //isInitializedHere = true;
          //integrate with the auto-redrawing system...
          //*
          m.startComputation();
          //internalInstance.diagramRendererInstance.render(internalInstance);
          internalInstance.render();
          internalInstance.on('rendered', function() {
            m.endComputation();
          });
          //*/
        } else if (!isInitialized) {
          internalInstance.render();
          //internalInstance.diagramRendererInstance.render(internalInstance);
          /*
          m.startComputation();
          internalInstance.diagramRendererInstance.render(internalInstance);
          m.endComputation();
          //*/
        }

        /*
        if (!isInitialized) {
          //integrate with the auto-redrawing system...
          m.startComputation();
          //internalInstance.diagramRendererInstance.render(internalInstance);
          internalInstance.render();
          internalInstance.on('rendered', function() {
            m.endComputation();
          });
        } else {
          m.startComputation();
          internalInstance.diagramRendererInstance.render(internalInstance);
          m.endComputation();
        }
        //*/
      },
      //*/
      //onclick: diagramComponent.vm.onClickHandler,
      //config: diagramComponent.config(ctrl),
      /*
      onchange: m.withAttr('value', diagramComponent.vm.updateColor),
      value: diagramComponent.vm.color()
      //*/
    });
  });

  return diagramComponent;
}

module.exports = DiagramComponent;
