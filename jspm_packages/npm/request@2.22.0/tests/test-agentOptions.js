/* */ 
var request = require("../index"),
    http = require("http"),
    server = require("./server"),
    assert = require("assert");
;
var s = http.createServer(function(req, resp) {
  resp.statusCode = 200;
  resp.end('');
}).listen(6767, function() {
  var r = request('http://localhost:6767', function(e, resp, body) {
    assert.deepEqual(r.agent, http.globalAgent);
    assert.equal(Object.keys(r.pool).length, 0);
    var r2 = request('http://localhost:6767', {agentOptions: {foo: 'bar'}}, function(e, resp, body) {
      assert.deepEqual(r2.agent.options, {foo: 'bar'});
      assert.equal(Object.keys(r2.pool).length, 1);
      s.close();
    });
  });
});
