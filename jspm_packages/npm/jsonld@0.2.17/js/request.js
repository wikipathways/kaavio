/* */ 
(function(Buffer, process) {
  (function() {
    'use strict';
    var fs = require("fs");
    var jsonld = require("./jsonld");
    try {
      var request = require("../browser/ignore");
    } catch (e) {}
    try {
      var jsdom = require("jsdom");
      var RDFa = require("./rdfa");
    } catch (e) {}
    function _clone(value) {
      if (value && typeof value === 'object') {
        var rval = Array.isArray(value) ? [] : {};
        for (var i in value) {
          rval[i] = _clone(value[i]);
        }
        return rval;
      }
      return value;
    }
    function _typedParse(loc, type, data, callback) {
      switch (type.toLowerCase()) {
        case 'text':
        case 'plain':
        case 'text/plain':
          callback(null, data);
          break;
        case 'json':
        case 'jsonld':
        case 'json-ld':
        case 'ld+json':
        case 'application/json':
        case 'application/ld+json':
          try {
            callback(null, JSON.parse(data));
          } catch (ex) {
            callback({
              message: 'Error parsing JSON.',
              contentType: type,
              url: loc,
              exception: ex.toString()
            });
          }
          break;
        case 'xml':
        case 'html':
        case 'xhtml':
        case 'text/html':
        case 'application/xhtml+xml':
          if (typeof jsdom === 'undefined') {
            callback({
              message: 'jsdom module not found.',
              contentType: type,
              url: loc
            });
            break;
          }
          if (typeof RDFa === 'undefined') {
            callback({
              message: 'RDFa module not found.',
              contentType: type,
              url: loc
            });
            break;
          }
          try {
            jsdom.env({
              url: loc,
              html: data,
              done: function(errors, window) {
                if (errors && errors.length > 0) {
                  return callback({
                    message: 'DOM Errors:',
                    errors: errors,
                    url: loc
                  });
                }
                try {
                  RDFa.attach(window.document);
                  jsonld.fromRDF(window.document.data, {format: 'rdfa-api'}, callback);
                } catch (ex) {
                  callback({
                    message: 'RDFa extraction error.',
                    contentType: type,
                    url: loc
                  });
                }
              }
            });
          } catch (ex) {
            callback({
              message: 'jsdom error.',
              contentType: type,
              url: loc
            });
          }
          break;
        default:
          callback({
            message: 'Unknown Content-Type.',
            contentType: type,
            url: loc
          });
      }
    }
    function endsWith(str, suffix) {
      return str.indexOf(suffix, str.length - suffix.length) !== -1;
    }
    function isSequence(data) {
      return typeof data === 'string' || Buffer.isBuffer(data);
    }
    function _parse(loc, type, data, callback) {
      var seq = isSequence(data);
      if (seq && data.length === 0) {
        return callback(null, null);
      }
      if (!seq && typeof data === 'object') {
        return callback(null, data);
      }
      if (type && type !== 'auto') {
        return _typedParse(loc, type, data, callback);
      }
      if (loc && (endsWith(loc, '.txt'))) {
        return _typedParse(loc, 'text', data, callback);
      }
      if (loc && (endsWith(loc, '.json') || endsWith(loc, '.jsonld') || endsWith(loc, '.json-ld'))) {
        return _typedParse(loc, 'json', data, callback);
      }
      if (loc && (endsWith(loc, '.xml') || endsWith(loc, '.html') || endsWith(loc, '.xhtml'))) {
        return _typedParse(loc, 'html', data, callback);
      }
      _typedParse(loc, 'application/ld+json', data, function(err, data) {
        if (err) {
          return _typedParse(loc, 'text/html', data, function(err, data) {
            if (err) {
              return callback({
                message: 'Unable to auto-detect format.',
                url: loc
              });
            }
            callback(null, data);
          });
        }
        callback(null, data);
      });
    }
    function _request(loc, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (!loc || loc === '-') {
        var data = '';
        process.stdin.resume();
        process.stdin.setEncoding(options.encoding || 'utf8');
        process.stdin.on('data', function(chunk) {
          data += chunk;
        });
        process.stdin.on('end', function() {
          _parse(loc, options.dataType, data, function(err, data) {
            callback(err, null, data);
          });
        });
      } else if (loc.indexOf('http://') === 0 || loc.indexOf('https://') === 0) {
        if (typeof request === 'undefined') {
          callback({
            message: 'request module not found.',
            url: loc
          });
          return ;
        }
        var opts = _clone(options);
        opts.url = loc;
        opts.encoding = opts.encoding || 'utf8';
        if (!('strictSSL' in opts)) {
          opts.strictSSL = true;
        }
        opts.headers = opts.headers || {};
        if (!('Accept' in opts.headers)) {
          opts.headers.Accept = 'application/ld+json; q=1.0, ' + 'application/json; q=0.8, ' + 'text/html; q=0.6, ' + 'application/xhtml+xml; q=0.6';
        }
        request(opts, function(err, res, body) {
          if (err) {
            return callback(err);
          }
          if (!(res.statusCode >= 200 && res.statusCode < 300)) {
            var msg = {
              message: 'Bad status code.',
              statusCode: res.statusCode,
              url: loc
            };
            if (body) {
              return _parse(loc, null, body, function(err, data) {
                if (err) {
                  data = body;
                }
                msg.body = data;
                callback(msg);
              });
            } else {
              return callback(msg);
            }
          }
          if (!body || (isSequence(body) && body.length === 0)) {
            return callback(null, null, null);
          }
          var dataType = options.dataType || (res.headers['content-type'] || '').split(';')[0];
          _parse(loc, dataType, body, function(err, data) {
            callback(err, res, data);
          });
        });
      } else {
        fs.readFile(loc, options.encoding || 'utf8', function(error, data) {
          if (error) {
            return callback(error);
          }
          _parse(loc, options.type, data, function(err, data) {
            callback(err, null, data);
          });
        });
      }
    }
    module.exports = _request;
  }());
})(require("buffer").Buffer, require("process"));
