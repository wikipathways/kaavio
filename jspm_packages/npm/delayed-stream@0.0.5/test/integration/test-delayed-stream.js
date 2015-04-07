/* */ 
var common = require("../common");
var assert = common.assert;
var fake = common.fake.create();
var DelayedStream = common.DelayedStream;
var Stream = require("stream").Stream;
(function testDelayEventsUntilResume() {
  var source = new Stream();
  var delayedStream = DelayedStream.create(source, {pauseStream: false});
  fake.expect(delayedStream, 'emit', 0);
  var params = [];
  source.on('foo', function(param) {
    params.push(param);
  });
  source.emit('foo', 1);
  source.emit('foo', 2);
  assert.deepEqual(params, [1, 2]);
  fake.verify();
  fake.stub(delayedStream, 'emit').times(Infinity).withArg(1, 'newListener');
  fake.expect(delayedStream, 'emit', ['foo', 1]);
  fake.expect(delayedStream, 'emit', ['foo', 2]);
  fake.expect(source, 'resume');
  delayedStream.resume();
  fake.verify();
  fake.expect(source, 'resume');
  delayedStream.resume();
  fake.verify();
  fake.expect(delayedStream, 'emit', ['foo', 3]);
  source.emit('foo', 3);
  fake.verify();
})();
