/* */ 
(function(process) {
  var S3Publisher = require("ember-publisher");
  var configPath = require("path").join(__dirname, '../config/s3ProjectConfig.js');
  publisher = new S3Publisher({projectConfigPath: configPath});
  publisher.currentBranch = function() {
    return (process.env.TRAVIS_BRANCH === 'master') ? 'wildcard' : 'no-op';
  };
  publisher.publish();
})(require("process"));
