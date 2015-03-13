var customElement = require('./src/custom-element');
var initKaavio = require('./src/kaavio');
var highland = require('highland');
var promisescript = require('promisescript');

/*********************************
 * A very simple asset loader. It checks all
 * assets that could be loaded already. If they
 * are loaded already, great. Otherwise, it
 * loads them.
 *
 * It would be nice to use an
 * open-source library for this
 * to ensure it works x-browser.
 * Why did Modernizr/yepnope deprecate this
 * type of strategy?
 * ******************************/
var assetsToLoad = [
  {
    exposed: 'd3',
    type: 'script',
    url: '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.6/d3.min.js',
    loaded: (function() {
      return !!window.d3;
    })()
  },
  {
    exposed: 'jQuery',
    type: 'script',
    url: '//cdnjs.cloudflare.com/ajax/libs/jquery/1.11.1/jquery.min.js',
    loaded: (function() {
      return !!window.jQuery;
    })()
  },
  {
    // TODO figure out the path for the jQuery typeahead.js
    // plugin, starting from window or document. We need it
    // to ensure the plugin has loaded.
    //exposed: '',
    type: 'script',
    url: '//cdnjs.cloudflare.com/ajax/libs/typeahead.js/0.10.2/' +
      'typeahead.bundle.min.js',
    loaded: (function() {
      return !!window.jQuery && !!window.jQuery('body').typeahead;
    })()
  },
  {
    exposed: 'document.registerElement',
    type: 'script',
    url: '//cdnjs.cloudflare.com/ajax/libs/' +
        'webcomponentsjs/0.5.2/CustomElements.min.js',
    loaded: (function() {
      return !!document.registerElement;
    })()
  },
  {
    exposed: 'Modernizr.inputtypes.color',
    type: 'script',
    url: '//cdnjs.cloudflare.com/ajax/libs/' +
        'spectrum/1.6.1/spectrum.min.js',
    loaded: (function() {
      return !!window.Modernizr.inputtypes.color;
    })()
  },
  {
    exposed: 'Modernizr.inputtypes.color',
    type: 'style',
    url: '//cdnjs.cloudflare.com/ajax/libs/' +
        'spectrum/1.6.1/spectrum.min.css',
    loaded: (function() {
      return !!window.Modernizr.inputtypes.color;
    })()
  }
];

/**
 * Streaming version of promisescript
 * https://www.npmjs.com/package/promisescript
 *
 * @param {object} args
 * @param {string} args.exposed
 * @param {string} args.type script or style
 * @param {string} args.url
 * @return {stream}
 */
function loadAssetStreaming(args) {
  return highland(promisescript(args));
}

highland(assetsToLoad)
  .filter(function(asset) {
    return !asset.loaded;
  })
  .errors(function(err, push) {
    push(err);
  })
  .flatMap(loadAssetStreaming)
  .collect()
  .each(function(result) {
    console.log('result');
    console.log(result);
    initKaavio(window, window.jQuery || null);
    customElement.registerElement();
  });
