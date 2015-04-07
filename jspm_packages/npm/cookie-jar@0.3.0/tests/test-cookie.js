/* */ 
var Cookie = require("../index"),
    assert = require("assert");
var str = 'Sid="s543qactge.wKE61E01Bs%2BKhzmxrwrnug="; Path=/; httpOnly; Expires=Sat, 04 Dec 2010 23:27:28 GMT';
var cookie = new Cookie(str);
assert.equal(cookie.toString(), str);
assert.equal(cookie.path, '/');
assert.equal(cookie.httpOnly, true);
assert.equal(cookie.name, 'Sid');
assert.equal(cookie.value, '"s543qactge.wKE61E01Bs%2BKhzmxrwrnug="');
assert.equal(cookie.expires instanceof Date, true);
var cookie = new Cookie('foo=bar', {url: 'http://foo.com/bar'});
assert.equal(cookie.path, '/bar');
console.log('All tests passed');
