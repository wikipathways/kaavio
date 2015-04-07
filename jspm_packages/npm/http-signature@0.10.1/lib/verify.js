/* */ 
var assert = require("assert-plus");
var crypto = require("crypto");
module.exports = {verifySignature: function verifySignature(parsedSignature, key) {
    assert.object(parsedSignature, 'parsedSignature');
    assert.string(key, 'key');
    var alg = parsedSignature.algorithm.match(/(HMAC|RSA|DSA)-(\w+)/);
    if (!alg || alg.length !== 3)
      throw new TypeError('parsedSignature: unsupported algorithm ' + parsedSignature.algorithm);
    if (alg[1] === 'HMAC') {
      var hmac = crypto.createHmac(alg[2].toUpperCase(), key);
      hmac.update(parsedSignature.signingString);
      return (hmac.digest('base64') === parsedSignature.params.signature);
    } else {
      var verify = crypto.createVerify(alg[0]);
      verify.update(parsedSignature.signingString);
      return verify.verify(key, parsedSignature.params.signature, 'base64');
    }
  }};
