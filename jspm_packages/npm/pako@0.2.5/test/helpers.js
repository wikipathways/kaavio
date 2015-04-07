/* */ 
(function(Buffer) {
  'use strict';
  var fs = require("fs");
  var path = require("path");
  var _ = require("lodash");
  var async = require("async");
  var pako_utils = require("../lib/utils/common");
  var pako = require("../index");
  function loadSamples(subdir) {
    var result = {};
    var dir = path.join(__dirname, 'fixtures', subdir || 'samples');
    fs.readdirSync(dir).sort().forEach(function(sample) {
      var filepath = path.join(dir, sample),
          extname = path.extname(filepath),
          basename = path.basename(filepath, extname),
          content = new Uint8Array(fs.readFileSync(filepath));
      if (basename[0] === '_') {
        return ;
      }
      result[basename] = content;
    });
    return result;
  }
  function cmpBuf(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    for (var i = 0,
        l = a.length; i < l; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  function testSingle(zlib_factory, pako_deflate, data, options, callback) {
    var zlib_options = _.clone(options);
    if (zlib_options.windowBits < 0) {
      zlib_options.windowBits = -zlib_options.windowBits;
    }
    var zlibStream = zlib_factory(zlib_options);
    var buffers = [],
        nread = 0;
    zlibStream.on('error', function(err) {
      zlibStream.removeAllListeners();
      zlibStream = null;
      callback(err);
    });
    zlibStream.on('data', function(chunk) {
      buffers.push(chunk);
      nread += chunk.length;
    });
    zlibStream.on('end', function() {
      zlibStream.removeAllListeners();
      zlibStream = null;
      var buffer = Buffer.concat(buffers);
      var pako_result = pako_deflate(data, options);
      if (!cmpBuf(buffer, pako_result)) {
        callback(new Error('zlib result != pako result'));
        return ;
      }
      callback(null);
    });
    zlibStream.write(new Buffer(data));
    zlibStream.end();
  }
  function testSamples(zlib_factory, pako_deflate, samples, options, callback) {
    var queue = [];
    _.forEach(samples, function(data, name) {
      queue.push(function(done) {
        pako_utils.setTyped(false);
        testSingle(zlib_factory, pako_deflate, data, options, function(err) {
          if (err) {
            done('Error in "' + name + '" - zlib result != pako result');
            return ;
          }
          done();
        });
      });
      queue.push(function(done) {
        pako_utils.setTyped(true);
        testSingle(zlib_factory, pako_deflate, data, options, function(err) {
          if (err) {
            done('Error in "' + name + '" - zlib result != pako result');
            return ;
          }
          done();
        });
      });
    });
    async.series(queue, callback);
  }
  function testInflate(samples, inflateOptions, deflateOptions, callback) {
    var name,
        data,
        deflated,
        inflated;
    for (name in samples) {
      data = samples[name];
      pako_utils.setTyped(true);
      deflated = pako.deflate(data, deflateOptions);
      pako_utils.setTyped(false);
      inflated = pako.inflate(deflated, inflateOptions);
      pako_utils.setTyped(true);
      if (!cmpBuf(inflated, data)) {
        callback('Error in "' + name + '" - inflate result != original');
        return ;
      }
      inflated = pako.inflate(deflated, inflateOptions);
      if (!cmpBuf(inflated, data)) {
        callback('Error in "' + name + '" - inflate result != original');
        return ;
      }
    }
    callback();
  }
  exports.cmpBuf = cmpBuf;
  exports.testSamples = testSamples;
  exports.testInflate = testInflate;
  exports.loadSamples = loadSamples;
})(require("buffer").Buffer);
