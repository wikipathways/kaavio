/* */ 
(function(process) {
  var fs = require("fs");
  var path = require("path");
  var URL = require("url");
  var request = require("request");
  var pkg = require("../package.json!systemjs-json");
  var toFileUrl = require("./jsdom/utils").toFileUrl;
  var style = require("./jsdom/level2/style");
  var features = require("./jsdom/browser/documentfeatures");
  var dom = exports.dom = require("./jsdom/level3/index").dom;
  var createWindow = exports.createWindow = require("./jsdom/browser/index").createWindow;
  exports.defaultLevel = dom.level3.html;
  exports.browserAugmentation = require("./jsdom/browser/index").browserAugmentation;
  exports.windowAugmentation = require("./jsdom/browser/index").windowAugmentation;
  ['availableDocumentFeatures', 'defaultDocumentFeatures', 'applyDocumentFeatures'].forEach(function(propName) {
    exports.__defineGetter__(propName, function() {
      return features[propName];
    });
    exports.__defineSetter__(propName, function(val) {
      return features[propName] = val;
    });
  });
  exports.debugMode = false;
  exports.__defineGetter__('version', function() {
    return pkg.version;
  });
  exports.level = function(level, feature) {
    if (!feature) {
      feature = 'core';
    }
    return require('./jsdom/level' + level + '/' + feature).dom['level' + level][feature];
  };
  exports.jsdom = function(html, level, options) {
    options = options || {};
    if (typeof level == 'string') {
      level = exports.level(level, 'html');
    } else {
      level = level || exports.defaultLevel;
    }
    if (!options.url) {
      options.url = (module.parent.id === 'jsdom') ? module.parent.parent.filename : module.parent.filename;
      options.url = options.url.replace(/\\/g, '/');
      if (options.url[0] !== '/') {
        options.url = '/' + options.url;
      }
      options.url = 'file://' + options.url;
    }
    var browser = exports.browserAugmentation(level, options),
        doc = (browser.HTMLDocument) ? new browser.HTMLDocument(options) : new browser.Document(options);
    require("./jsdom/selectors/index").applyQuerySelector(doc, level);
    features.applyDocumentFeatures(doc, options.features);
    if (typeof html === 'undefined' || html === null) {
      doc.write('<html><head></head><body></body></html>');
    } else {
      doc.write(html + '');
    }
    if (doc.close && !options.deferClose) {
      doc.close();
    }
    doc.createWindow = function() {
      if (doc.createWindow) {
        delete doc.createWindow;
      }
      return doc.parentWindow;
    };
    return doc;
  };
  exports.html = function(html, level, options) {
    html += '';
    var htmlLowered = html.toLowerCase();
    if (!~htmlLowered.indexOf('<body')) {
      html = '<body>' + html + '</body>';
    }
    if (!~htmlLowered.indexOf('<html')) {
      html = '<html>' + html + '</html>';
    }
    return exports.jsdom(html, level, options);
  };
  exports.jQueryify = exports.jsdom.jQueryify = function(window) {
    if (!window || !window.document) {
      return ;
    }
    var args = Array.prototype.slice.call(arguments),
        callback = (typeof(args[args.length - 1]) === 'function') && args.pop(),
        path,
        jQueryTag = window.document.createElement('script');
    jQueryTag.className = 'jsdom';
    if (args.length > 1 && typeof(args[1] === 'string')) {
      path = args[1];
    }
    var features = window.document.implementation._features;
    window.document.implementation.addFeature('FetchExternalResources', ['script']);
    window.document.implementation.addFeature('ProcessExternalResources', ['script']);
    window.document.implementation.addFeature('MutationEvents', ['2.0']);
    jQueryTag.src = path || 'http://code.jquery.com/jquery-latest.js';
    window.document.body.appendChild(jQueryTag);
    jQueryTag.onload = function() {
      if (callback) {
        callback(window, window.jQuery);
      }
      window.document.implementation._features = features;
    };
    return window;
  };
  exports.env = exports.jsdom.env = function() {
    var config = getConfigFromArguments(arguments);
    var callback = config.done;
    if (config.file) {
      fs.readFile(config.file, 'utf-8', function(err, text) {
        if (err) {
          return callback(err);
        }
        config.html = text;
        processHTML(config);
      });
    } else if (config.html) {
      processHTML(config);
    } else if (config.url) {
      handleUrl(config);
    } else if (config.somethingToAutodetect) {
      var url = URL.parse(config.somethingToAutodetect);
      if (url.protocol && url.hostname) {
        config.url = config.somethingToAutodetect;
        handleUrl(config.somethingToAutodetect);
      } else {
        fs.readFile(config.somethingToAutodetect, 'utf-8', function(err, text) {
          if (err) {
            if (err.code === 'ENOENT') {
              config.html = config.somethingToAutodetect;
              processHTML(config);
            } else {
              callback(err);
            }
          } else {
            config.html = text;
            config.url = toFileUrl(config.somethingToAutodetect);
            processHTML(config);
          }
        });
      }
    }
    function handleUrl() {
      var options = {
        uri: config.url,
        encoding: config.encoding || 'utf8',
        headers: config.headers || {},
        proxy: config.proxy || null
      };
      request(options, function(err, res, responseText) {
        if (err) {
          return callback(err);
        }
        config.html = responseText;
        config.url = res.request.uri.href;
        processHTML(config);
      });
    }
  };
  function processHTML(config) {
    var callback = config.done;
    var options = {
      features: config.features,
      url: config.url,
      parser: config.parser
    };
    var window = exports.html(config.html, null, options).createWindow();
    var features = JSON.parse(JSON.stringify(window.document.implementation._features));
    var docsLoaded = 0;
    var totalDocs = config.scripts.length + config.src.length;
    var readyState = null;
    var errors = [];
    if (!window || !window.document) {
      return callback(new Error('JSDOM: a window object could not be created.'));
    }
    if (config.document) {
      window.document._referrer = config.document.referrer;
      window.document._cookie = config.document.cookie;
    }
    window.document.implementation.addFeature('FetchExternalResources', ['script']);
    window.document.implementation.addFeature('ProcessExternalResources', ['script']);
    window.document.implementation.addFeature('MutationEvents', ['2.0']);
    function scriptComplete() {
      docsLoaded++;
      if (docsLoaded >= totalDocs) {
        window.document.implementation._features = features;
        errors = errors.concat(window.document.errors || []);
        if (errors.length === 0) {
          errors = null;
        }
        process.nextTick(function() {
          callback(errors, window);
        });
      }
    }
    function handleScriptError(e) {
      if (!errors) {
        errors = [];
      }
      errors.push(e.error || e.message);
      process.nextTick(scriptComplete);
    }
    if (config.scripts.length > 0 || config.src.length > 0) {
      config.scripts.forEach(function(scriptSrc) {
        var script = window.document.createElement('script');
        script.className = 'jsdom';
        script.onload = scriptComplete;
        script.onerror = handleScriptError;
        script.src = scriptSrc;
        try {
          window.document.documentElement.appendChild(script);
        } catch (e) {
          handleScriptError(e);
        }
      });
      config.src.forEach(function(scriptText) {
        var script = window.document.createElement('script');
        script.onload = scriptComplete;
        script.onerror = handleScriptError;
        script.text = scriptText;
        window.document.documentElement.appendChild(script);
        window.document.documentElement.removeChild(script);
      });
    } else {
      scriptComplete();
    }
  }
  function getConfigFromArguments(args, callback) {
    var config = {};
    if (typeof args[0] === 'object') {
      var configToClone = args[0];
      Object.keys(configToClone).forEach(function(key) {
        config[key] = configToClone[key];
      });
    } else {
      var stringToAutodetect = null;
      Array.prototype.forEach.call(args, function(arg) {
        switch (typeof arg) {
          case 'string':
            config.somethingToAutodetect = arg;
            break;
          case 'function':
            config.done = arg;
            break;
          case 'object':
            if (Array.isArray(arg)) {
              config.scripts = arg;
            } else {
              extend(config, arg);
            }
            break;
        }
      });
    }
    if (!config.done) {
      throw new Error('Must pass a "done" option or a callback to jsdom.env.');
    }
    if (!config.somethingToAutodetect && !config.html && !config.file && !config.url) {
      throw new Error('Must pass a "html", "file", or "url" option, or a string, to jsdom.env');
    }
    config.scripts = ensureArray(config.scripts);
    config.src = ensureArray(config.src);
    config.features = config.features || {
      FetchExternalResources: false,
      ProcessExternalResources: false,
      SkipExternalResources: false
    };
    if (!config.url && config.file) {
      config.url = toFileUrl(config.file);
    }
    return config;
  }
  function ensureArray(value) {
    var array = value || [];
    if (typeof array === 'string') {
      array = [array];
    }
    return array;
  }
  function extend(config, overrides) {
    Object.keys(overrides).forEach(function(key) {
      config[key] = overrides[key];
    });
  }
})(require("process"));
