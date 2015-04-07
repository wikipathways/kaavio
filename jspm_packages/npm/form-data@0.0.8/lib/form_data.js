/* */ 
(function(Buffer, process) {
  var CombinedStream = require("combined-stream");
  var util = require("util");
  var path = require("path");
  var http = require("http");
  var https = require("https");
  var parseUrl = require("url").parse;
  var fs = require("fs");
  var mime = require("mime");
  var async = require("async");
  module.exports = FormData;
  function FormData() {
    this._overheadLength = 0;
    this._valueLength = 0;
    this._lengthRetrievers = [];
    CombinedStream.call(this);
  }
  util.inherits(FormData, CombinedStream);
  FormData.LINE_BREAK = '\r\n';
  FormData.prototype.append = function(field, value, options) {
    options = options || {};
    var append = CombinedStream.prototype.append.bind(this);
    if (typeof value == 'number')
      value = '' + value;
    var header = this._multiPartHeader(field, value, options);
    var footer = this._multiPartFooter(field, value, options);
    append(header);
    append(value);
    append(footer);
    this._trackLength(header, value, options);
  };
  FormData.prototype._trackLength = function(header, value, options) {
    var valueLength = 0;
    if (options.knownLength != null) {
      valueLength += +options.knownLength;
    } else if (Buffer.isBuffer(value)) {
      valueLength = value.length;
    } else if (typeof value === 'string') {
      valueLength = Buffer.byteLength(value);
    }
    this._valueLength += valueLength;
    this._overheadLength += Buffer.byteLength(header) + +FormData.LINE_BREAK.length;
    if (!value || (!value.path && !(value.readable && value.hasOwnProperty('httpVersion')))) {
      return ;
    }
    this._lengthRetrievers.push(function(next) {
      if (options.knownLength != null) {
        next(null, 0);
      } else if (value.hasOwnProperty('fd')) {
        fs.stat(value.path, function(err, stat) {
          if (err) {
            next(err);
            return ;
          }
          next(null, stat.size);
        });
      } else if (value.hasOwnProperty('httpVersion')) {
        next(null, +value.headers['content-length']);
      } else if (value.hasOwnProperty('httpModule')) {
        value.on('response', function(response) {
          value.pause();
          next(null, +response.headers['content-length']);
        });
        value.resume();
      } else {
        next('Unknown stream');
      }
    });
  };
  FormData.prototype._multiPartHeader = function(field, value, options) {
    var boundary = this.getBoundary();
    var header = '';
    if (options.header != null) {
      header = options.header;
    } else {
      header += '--' + boundary + FormData.LINE_BREAK + 'Content-Disposition: form-data; name="' + field + '"';
      if (options.filename || value.path) {
        header += '; filename="' + path.basename(options.filename || value.path) + '"' + FormData.LINE_BREAK + 'Content-Type: ' + (options.contentType || mime.lookup(options.filename || value.path));
      } else if (value.readable && value.hasOwnProperty('httpVersion')) {
        header += '; filename="' + path.basename(value.client._httpMessage.path) + '"' + FormData.LINE_BREAK + 'Content-Type: ' + value.headers['content-type'];
      }
      header += FormData.LINE_BREAK + FormData.LINE_BREAK;
    }
    return header;
  };
  FormData.prototype._multiPartFooter = function(field, value, options) {
    return function(next) {
      var footer = FormData.LINE_BREAK;
      var lastPart = (this._streams.length === 0);
      if (lastPart) {
        footer += this._lastBoundary();
      }
      next(footer);
    }.bind(this);
  };
  FormData.prototype._lastBoundary = function() {
    return '--' + this.getBoundary() + '--';
  };
  FormData.prototype.getHeaders = function(userHeaders) {
    var formHeaders = {'content-type': 'multipart/form-data; boundary=' + this.getBoundary()};
    for (var header in userHeaders) {
      formHeaders[header.toLowerCase()] = userHeaders[header];
    }
    return formHeaders;
  };
  FormData.prototype.getCustomHeaders = function(contentType) {
    contentType = contentType ? contentType : 'multipart/form-data';
    var formHeaders = {
      'content-type': contentType + '; boundary=' + this.getBoundary(),
      'content-length': this.getLengthSync()
    };
    return formHeaders;
  };
  FormData.prototype.getBoundary = function() {
    if (!this._boundary) {
      this._generateBoundary();
    }
    return this._boundary;
  };
  FormData.prototype._generateBoundary = function() {
    var boundary = '--------------------------';
    for (var i = 0; i < 24; i++) {
      boundary += Math.floor(Math.random() * 10).toString(16);
    }
    this._boundary = boundary;
  };
  FormData.prototype.getLengthSync = function() {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
      knownLength += this._lastBoundary().length;
    }
    return knownLength;
  };
  FormData.prototype.getLength = function(cb) {
    var knownLength = this._overheadLength + this._valueLength;
    if (this._streams.length) {
      knownLength += this._lastBoundary().length;
    }
    if (!this._lengthRetrievers.length) {
      process.nextTick(cb.bind(this, null, knownLength));
      return ;
    }
    async.parallel(this._lengthRetrievers, function(err, values) {
      if (err) {
        cb(err);
        return ;
      }
      values.forEach(function(length) {
        knownLength += length;
      });
      cb(null, knownLength);
    });
  };
  FormData.prototype.submit = function(params, cb) {
    this.getLength(function(err, length) {
      var request,
          options,
          defaults = {
            method: 'post',
            port: 80,
            headers: this.getHeaders({'Content-Length': length})
          };
      if (typeof params == 'string') {
        params = parseUrl(params);
        options = populate({
          port: params.port,
          path: params.pathname,
          host: params.hostname
        }, defaults);
      } else {
        options = populate(params, defaults);
      }
      if (params.protocol == 'https:') {
        if (!params.port)
          options.port = 443;
        request = https.request(options);
      } else {
        request = http.request(options);
      }
      this.pipe(request);
      if (cb) {
        request.on('error', cb);
        request.on('response', cb.bind(this, null));
      }
      return request;
    }.bind(this));
  };
  function populate(dst, src) {
    for (var prop in src) {
      if (!dst[prop])
        dst[prop] = src[prop];
    }
    return dst;
  }
})(require("buffer").Buffer, require("process"));
