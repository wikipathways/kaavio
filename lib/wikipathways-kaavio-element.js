var Kaavio = require('./main.js');

/**
 * Enable the wikipathways-kaavio custom element
 *
 * @return
 */
(function registerWikipathwaysKaavioElement(window) {
  'use strict';

  var DivPrototype = Object.create(window.HTMLDivElement.prototype);

  DivPrototype.attributeChangedCallback = function(
      attrName, oldValue, newValue) {
    if (attrName === 'alt') {
      this.textContent = newValue;
    }
  };

  var WikipathwaysKaavioPrototype = Object.create(DivPrototype);

  WikipathwaysKaavioPrototype.createdCallback = function() {
    var vm = this;
    var options = {};

    var alt = options.alt = vm.getAttribute('alt');
    if (!!alt) {
      vm.attributeChangedCallback('alt', null, alt);
    }

    var displayErrors = options.displayErrors =
        Boolean(vm.getAttribute('display-errors'));
    if (!!displayErrors) {
      vm.attributeChangedCallback('display-errors', null, displayErrors);
    }

    var displayWarnings = options.displayErrors =
        Boolean(vm.getAttribute('display-warnings'));
    if (!!displayWarnings) {
      vm.attributeChangedCallback('display-warnings', null, displayWarnings);
    }

    var fitToContainer = options.fitToContainer =
        Boolean(vm.getAttribute('fit-to-container'));
    if (!!fitToContainer) {
      vm.attributeChangedCallback('fit-to-container', null, fitToContainer);
    }

    /*
    var highlight = vm.getAttribute('highlight');
    if (!!highlight) {
      highlight = JSON.parse(highlight);
      highlight = !!highlight.length ? highlight : [highlight];
      options.highlight = highlight;
      vm.attributeChangedCallback('highlight', null, highlight);
    }
    //*/

    /* TODO should this be enabled? It doesn't seem needed for the web-component.
    var manualRender = options.manualRender =
        Boolean(vm.getAttribute('manual-render'));
    if (!!manualRender) {
      vm.attributeChangedCallback('manual-render', null, manualRender);
    }
    //*/

    var src = vm.getAttribute('src');
    if (!!src) {
      vm.attributeChangedCallback('src', null, src);
    }

    options.src = src;

    vm.innerHTML = '';

    //$(vm).kaavio(options);
    var kaavio = new Kaavio(vm, options)

    // Load notification plugin
    if (!!window.kaavioNotifications) {
      window.kaavioNotifications(vm, {
        displayErrors: displayErrors,
        displayWarnings: displayWarnings
      });
    }

    /*
    // Call after render
    vm.on('rendered', function() {
      // do something
    });
    //*/
  };

  // Public: WikipathwaysKaavioPrototype constructor.
  //
  //   # => <wikipathways-kaavio></wikipathways-kaavio>
  //
  window.WikipathwaysKaavioElement = document.registerElement(
      'wikipathways-kaavio', {
      prototype: WikipathwaysKaavioPrototype
  });
}(window));
