/* */ 
var config = require("./config");
var httpErrors = function(args) {
  var error = args.error;
  var response = args.response;
  var body = args.body;
  var stream = args.stream;
  var source = args.source;
  if (!!response && !!response.statusCode) {
    var statusCode = response.statusCode;
    var statusCodeFirstCharacter = statusCode.toString()[0];
    if (statusCodeFirstCharacter === '4' || statusCodeFirstCharacter === '5') {
      error = error || new Error('HTTP status code ' + statusCode);
    }
  }
  console.log('Checking for errors: ' + source);
  if (!error) {
    return ;
  }
  console.log('Error getting ' + source);
  console.log(error);
  setTimeout(function() {}, config.http.retryDelay);
};
module.exports = httpErrors;
