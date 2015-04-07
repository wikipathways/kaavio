/* */ 
var common = require("../common");
var assert = common.assert;
var fake = common.fake.create();
var DelayedStream = common.DelayedStream;
var Stream = require("stream").Stream;
(function testHandleSourceErrors() {
  var source = new Stream();
  var delayedStream = DelayedStream.create(source, {pauseStream: false});
  source.emit('error', new Error('something went wrong'));
})();
