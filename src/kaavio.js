var _ = require('lodash');
var customElement = require('./custom-element');
var DiagramComponent = require('./diagram-renderer/diagram-component');
var Editor = require('./editor/editor');
var ElementResizeDetector = require('element-resize-detector');
var fs = require('fs');
var highland = require('highland');
var insertCss = require('insert-css');
var m = require('mithril');
var KaavioHighlighter = require('./highlighter/highlighter.js');
var Utils = require('./utils');
var DiagramRenderer = require('./diagram-renderer/diagram-renderer');
var Spinner = require('spin.js');

// Make IE work with the CustomEvent interface standard
require('custom-event-polyfill');

var css = [
  fs.readFileSync(__dirname + '/kaavio.css')
];

/**
 * Initialize the global constructor for Kaavio
 *
 * @param {object} window
 * @param {object} $
 * @return
 */
module.exports = function(window, $) {
  'use strict';

  // TODO should we check for whether the user requested the highlighter
  // before loading it?
  if (window.hasOwnProperty('initKaavioHighlighter')) {
    window.initKaavioHighlighter(window, $);
  }

  var diagramRenderer = new DiagramRenderer();
  css.map(insertCss);

  /**
   * Kaavio constructor
   *
   * @param {object} element Dom element
   * @param {object} options
   */
  var Kaavio = function(element, options) {
    this.init(element, options);
  };

  var instanceCounter = 0;
  var optionsDefault = {
    fitToContainer: true,
    sourceData: [],
    manualRender: false,
    //editor: 'open'
    editor: 'closed'
  };

  /**
   * Kaavio initialisation
   *
   * @param  {object} element Dom element
   * @param  {object} options
   */
  Kaavio.prototype.init = function(element, options) {
    this.$element = d3.select(element).html(''); // select and empty the element

    var spinnerOptions = {
      lines: 13, // The number of lines to draw
      length: 20, // The length of each line
      width: 10, // The line thickness
      radius: 30, // The radius of the inner circle
      corners: 1, // Corner roundness (0..1)
      rotate: 0, // The rotation offset
      direction: 1, // 1: clockwise, -1: counterclockwise
      color: '#000', // #rgb or #rrggbb or array of colors
      speed: 1, // Rounds per second
      trail: 60, // Afterglow percentage
      shadow: false, // Whether to render a shadow
      hwaccel: false, // Whether to use hardware acceleration
      className: 'spinner', // The CSS class to assign to the spinner
      zIndex: 2e9, // The z-index (defaults to 2000000000)
      top: '50%', // Top position relative to parent
      left: '50%' // Left position relative to parent
    };

    var spinner = new Spinner(spinnerOptions).spin(element);

    // Clone and fill options
    this.options = _.clone(optionsDefault, true);
    this.options = _.assign(this.options, options);

    // Make this instance unique
    this.instanceId = ++instanceCounter;

    // Init events object
    this.events = {};

    this.initContainer();

    /*
    // Check if render should be called now or it will be done later manually
    if (!this.options.manualRender) {
      this.render(this);
    }
    //*/
  };

  /**
   * Creates DOM container and parses its sizes.
   * Adds loading state to container.
   * Adds hook for loaded event to remove loading state
   */
  Kaavio.prototype.initContainer = function() {
    var kaavio = this;

    var containerElement = this.$element[0][0];
    kaavio.editor = new Editor(kaavio);
    var diagramComponent = new DiagramComponent(kaavio);

    var kaavioComponent = {};

    kaavioComponent.controller = function() {
      this.onunload = function() {
        console.log('unloading kaavioComponent module');

        //diagramComponent.vm.onunload();
        kaavio.editor.vm.onunload();
      };
      kaavio.editor.vm.init(kaavio);
    };

    kaavioComponent.view = function(controller) {
      return [
        m('div.diagram-container.editor-' + m.route.param('editorState'), [
          diagramComponent.view,
        ]),
        kaavio.editor.view(),
        m('div.annotation.ui-draggable.editor-' + m.route.param('editorState'), {}, [
          m('header.annotation-header', {}, [
            m('span.annotation-header-move', {}, [
              m('i.icon-move'),
            ]),
            m('span.annotation-header-close', {}, [
              m('i.icon-remove'),
            ]),
            m('span.annotation-header-text', 'Header'),
            m('div.annotation-description', {}, [
              m('h2', {}, 'description'),
            ]),
          ]),
          m('span.annotation-items-container', {}, [
            /*
               List items inside this ul element are generated automatically by JavaScript.
               Each item will be composed of a title and text. The text can be set to be an href.
               You can edit the styling of the title by editing CSS class "annotation-item-title"
               and the styling of the text by editing CSS class "annotation-item-text.
            //*/
            m('ul.annotation-items-container-list'),
          ]),
        ]),
      ];
    };

    //setup routes to start w/ the `#` symbol
    m.route.mode = 'hash';

    //define a route
    m.route(containerElement, '/editor/closed', {
      '/editor/:editorState': kaavioComponent,
      '/test': kaavioComponent
    });

    // Set ID to container element if it has no ID
    var containerElementId = containerElement.getAttribute('id') || 'kaavio-' + this.instanceId;
    containerElement.setAttribute('id', containerElementId);

    // TODO Look into allowing user to override our default styling,
    // possibly via a custom stylesheet.
    Utils.addClassForD3(this.$element, 'kaavio-container');

    // Set loading class
    Utils.addClassForD3(this.$element, 'loading');

    // Remove loading state after kaavio is loaded
    this.on('rendered', function() {
      Utils.removeClassForD3(kaavio.$element, 'loading');

      // Initialize Highlighter plugin
      kaavio.publicInstance.highlighter = new KaavioHighlighter(kaavio.publicInstance);

      var diagramContainerElement = containerElement.querySelector(
          '.diagram-container');

      var createEventListenerStream = function(type, eventTarget) {
        var addEventListenerCurried =
            highland.ncurry(2, eventTarget.addEventListener, type);

        var addEventListenerFlipped = highland.flip(addEventListenerCurried);

        var createStream = highland.wrapCallback(addEventListenerFlipped);

        var stream = createStream(type)
        .errors(function(err, push) {
          // The callback is not a Node.js-style callback
          // with err as the first argument, so we need
          // to push it along if it's an event, not an error.
          // TODO is this a cross-browser compatible
          // for detecting an event?
          if (err.hasOwnProperty('bubbles')) {
            return push(null, err);
          }

          throw err;
        });

        return stream;
      }

      // corresponds to ~60Hz
      var refreshInterval = 16;

      // TODO look at using wrapCallbackUnending here
      // to avoid the issue with forking and recursion.
      var createWindowResizeListener = function() {
        var windowResizeListener = createEventListenerStream('resize', window);
        windowResizeListener.fork()
        .debounce(refreshInterval)
        .each(function() {
          /* Change this so it works. This was pulled from the element resize listener.
          if (_.isElement(element)) {
            diagramContainerElement.setAttribute('style',
              'width: ' + element.clientWidth + 'px; ' +
              'height: ' + element.clientHeight + 'px; ')
            diagramContainerElement.setAttribute('style',
              'width: ' + element.clientWidth + 'px; ' +
              'height: ' + element.clientHeight + 'px; ')
          }
          //*/
          kaavio.publicInstance.resizeDiagram();
        });

        // TODO This seems kludgey.
        windowResizeListener.fork()
        .last()
        .each(function() {
          createWindowResizeListener();
        });
      };
      createWindowResizeListener();

      function wrapCallbackUnending(fn) {
        return highland(function(push, next) {
          fn(function(data) {
            // TODO figure out why lodash throws the error below
            // when I try to use _.isError()
            // "Uncaught TypeError: undefined is not a function"
            // It's probably becase I'm using an old version of lodash
            // that doesn't yet have the isError method.
            //if (_.isError(data)) {}
            // Using the following as error detector, until I update the
            // lodash version.
            if (!!data.message && !!data.name &&
                data.name.toLowerCase().indexOf('error') > -1) {
              var err = data;
              push(err);
              return next();
            }

            push(null, data);
            return next();
          });
        });
      }

      // TODO avoid multiple resize event listeners. One should work fine.
      // But right now, it doesn't.
      var elementResizeDetectorInstance = new ElementResizeDetector({
        allowMultipleListeners: true
      });
      var createElementResizeListener = function(element) {
        var curried = highland.curry(
            elementResizeDetectorInstance.listenTo, element);
        return wrapCallbackUnending(curried);
      };

      createElementResizeListener(containerElement)
        .debounce(refreshInterval)
        .each(function(element) {
          console.log('element resized');
          kaavio.publicInstance.resizeDiagram();
        });

      /*// TODO read the URL query parameters and also the
        // highlight="[{}, {}]" attribute to get these values

      // Initialize Highlighter plugin
      var hi = kaavioHighlighter(kaavio.publicInstance);
      // TODO don't use hi in global namespace
      window.hi = hi;

      // TODO don't hard-code these
      // Highlight by ID
      hi.highlight('#eb5');
      hi.highlight('id:d25e1');

      // Highlight by Text
      hi.highlight('Mitochondrion', null, {backgroundColor: 'gray'});

      // Highlight by xref
      hi.highlight('xref:id:http://identifiers.org/wormbase/ZK1193.5', null, {
        backgroundColor: 'magenta', borderColor: 'black'})
      hi.highlight('xref:GCN-2', null, {
        backgroundColor: 'blue',
        backgroundOpacity: 0.5,
        borderColor: 'red',
        borderWidth: 1,
        borderOpacity: 0.7
      });
      //*/
    });

    // Get container sizes
    var boundingRect = containerElement.getBoundingClientRect();

    // TODO take in account paddings, margins and border
    this.elementWidth = +boundingRect.width;

    // TODO take in account paddings, margins and border
    this.elementHeight = +boundingRect.height;

  };

  /**
   * Init and render
   */
  Kaavio.prototype.render = function() {
    var kaavio = this;

    // Init sourceData object
    kaavio.sourceData = {
      pvjson: null, // pvjson object
      selector: null, // selector instance
      rendererEngine: null // renderer engine name
    };

    var pvjson = kaavio.options.pvjson;
    var src = kaavio.options.src;

    if (!!pvjson) {
      kaavio.sourceData.pvjson = pvjson;
      diagramRenderer.render(kaavio);
    } else if (!!src) {
      d3.json(src, function(err, pvjson) {
        if (err) {
          throw err;
        }
        kaavio.sourceData.pvjson = pvjson;
        diagramRenderer.render(kaavio);
      });
    } else {
      throw new Error('Cannot handle provided src. Please provide an IRI or a parsed JSON object.')
    }

    // Listen for renderer errors
    this.on('error.renderer', function() {
      diagramRenderer.destroyRender(kaavio, kaavio.sourceData);
    });
  };

  Kaavio.prototype.destroy = function() {
    // Send destroy message
    this.trigger(
        'destroy.kaavio', {message: 'User requested kaavio destroy'}, false)

    // Destroy renderer
    diagramRenderer.destroyRender(this, this.sourceData)

    // Off all events
    for (var e in this.events) {
      this.off(e)
    }

    // Clean data
    this.$element[0][0].data = undefined

    if ($) {
      $(this.$element[0][0]).removeData('kaavio')
    }

    // Clean HTML
    // jQuery
    $(this.$element[0][0]).empty()

  }

  /**
   * Returns an instance for public usage
   * @return {object}
   */
  Kaavio.prototype.getPublicInstance = function() {
    var that = this;

    if (this.publicInstance === undefined) {
      // Initialise public instance
      this.publicInstance = {
        instanceId: this.instanceId,
        $element: this.$element,
        destroy: Utils.proxy(this.destroy, this),
        on: Utils.proxy(this.on, this),
        off: Utils.proxy(this.off, this),
        trigger: Utils.proxy(this.trigger, this),
        render: Utils.proxy(this.render, this),
        pan: function(point) {if (that.panZoom) {that.panZoom.pan(point);}},
        panBy: function(point) {if (that.panZoom) {that.panZoom.panBy(point);}},
        getPan: function() {return that.panZoom.getPan();},
        resizeDiagram: function() {return that.panZoom.resizeDiagram();},
        zoom: function(scale) {if (that.panZoom) {that.panZoom.zoom(scale);}},
        zoomBy: function(scale) {
          if (that.panZoom) {
            that.panZoom.zoomBy(scale);
          }
        },
        zoomAtPoint: function(scale, point) {
          if (that.panZoom) {
            that.panZoom.zoomAtPoint(scale, point);
          }
        },
        zoomAtPointBy: function(scale, point) {
          if (that.panZoom) {
            that.panZoom.zoomAtPointBy(scale, point);
          }
        },
        getZoom: function() {return that.panZoom.getZoom();},
        getOptions: function() {return _.clone(that.options, true);},
        getSourceData: function() {
          // return _.clone(that.sourceData, true);
          return {
            pvjson: _.clone(that.sourceData.pvjson, true),
            selector: that.sourceData.selector.getClone(),
            rendererEngine: that.sourceData.rendererEngine
          };
        }
      };
    }

    return this.publicInstance;
  };

  /**
   * Register an event listener
   *
   * @param  {string}   topic
   * @param  {Function} callback
   */
  Kaavio.prototype.on = function(topic, callback) {
    var namespace = null;
    var eventName = topic;

    if (topic.indexOf('.') !== -1) {
      var pieces = topic.split('.');
      eventName = pieces[0];
      namespace = pieces[1];
    }

    if (!this.events.hasOwnProperty(eventName)) {
      this.events[eventName] = [];
    }

    this.events[eventName].push({
      callback: callback,
      namespace: namespace
    });
  };

  /**
   * Removes an event listener
   * Returns true if listener was removed
   *
   * @param  {string}   topic
   * @param  {Function} callback
   * @return {bool}
   */
  Kaavio.prototype.off = function(topic, callback) {
    var namespace = null;
    var eventName = topic;
    var flagRemove = true;
    callback = callback || null;

    if (topic.indexOf('.') !== -1) {
      var pieces = topic.split('.');
      eventName = pieces[0];
      namespace = pieces[1];
    }

    // Check if such an event is registered
    if (!this.events.hasOwnProperty(eventName)) {return false;}
    var queue = this.events[topic];

    for (var i = queue.length - 1; i >= 0; i--) {
      flagRemove = true;

      if (namespace && queue[i].namespace !== namespace) {flagRemove = false;}
      if (callback && queue[i].callback !== callback) {flagRemove = false;}

      if (flagRemove) {queue.splice(i, 1);}
    }

    return true;
  };

  /**
   * Triggers an event. Async by default.
   * Returns true if there is at least one listener
   *
   * @param  {string} topic
   * @param  {object} message
   * @param  {bool} async By default true
   * @return {bool}
   */
  Kaavio.prototype.trigger = function(topic, message, async) {
    var namespace = null;
    var eventName = topic;

    if (topic.indexOf('.') !== -1) {
      var pieces = topic.split('.');
      eventName = pieces[0];
      namespace = pieces[1];
    }

    if (!this.events.hasOwnProperty(eventName)) {return false;}

    var queue = this.events[eventName];
    if (queue.length === 0) {return false;}

    if (async === undefined) {
      async = true;
    }

    // Use a function as i may change meanwhile
    var callAsync = function(i) {
      setTimeout(function() {
        queue[i].callback(message);
      }, 0);
    };

    for (var i = 0; i < queue.length; i++) {
      if (namespace && queue[i].namespace && namespace !== queue[i].namespace) {
        continue;
      }

      if (async) {
        // freeze i
        callAsync(i);
      } else {
        queue[i].callback(message);
      }
    }
    return true;
  };

  /**
   *
   */
  if ($) {
    /**
     * jQuery plugin entry point. Only if jQuery is defined.
     * If option is 'get' then returns an array of kaavio public instances.
     * Otherwise returns an jQuery object to allow chaining.
     *
     * @param  {string} option
     * @return {object} array || jQuery object
     */
    $.fn.kaavio = function(option) {
      // Instantiate Kaavio for all elements
      var $return = this.each(function() {
        var $this = $(this);
        var data = $this.data('kaavio');
        var options = typeof option == 'object' && option;

        if (!data) {
          $this.data('kaavio', (new Kaavio(this, options)));
        }
      });

      if (option === 'get') {
        // Return an array of Kaavio instances
        return $.map(this, function(a) {
          return $(a).data('kaavio').getPublicInstance();
        });
      } else {
        // Return jQuery object
        return $return;
      }
    };
  }

  /**
   * Globally available method
   * Returns an array of public instances
   *
   * @param  {string} selector
   * @param  {object} option
   * @return {array}
   */
  window.kaavio = function(selector, option) {
    var $elements;

    if (Utils.isElement(selector)) {
      $elements = [[selector]];
    } else {
      $elements = d3.selectAll(selector);
    }

    return _.map($elements[0], function(element) {
      if (element.data === undefined) {element.data = {};}

      var data;
      var options = typeof option == 'object' ? option : {};

      if (element.data.kaavio === undefined) {
        element.data.kaavio = (data = new Kaavio(element, options));
      } else {
        data = element.data.kaavio;
      }

      return data.getPublicInstance();
    });
  };

  var kaavioreadyEvent = new CustomEvent('kaavioready');
  window.dispatchEvent(kaavioreadyEvent);
};
