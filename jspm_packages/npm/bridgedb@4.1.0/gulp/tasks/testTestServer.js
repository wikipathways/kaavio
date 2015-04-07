/* */ 
(function(process) {
  var gulp = require("gulp"),
      _ = require("lodash"),
      args = require("yargs").argv,
      fs = require("fs"),
      highland = require("highland"),
      path = require("path"),
      through = require("through"),
      SpawnMocha = require("spawn-mocha-parallel"),
      seleniumLauncher = require("selenium-launcher");
  ;
  require("bdd-with-opts");
  gulp.task('testTestServer', function() {
    var selenium;
    var browsersCompletedCount = 0;
    var pathwayIndexOneBased = 1;
    var expressPort = 3000;
    args.browsers = (args.browser || 'phantomjs,firefox,safari').split(',');
    var batchSize;
    if (args.browsers.length > 1) {
      batchSize = 1;
    } else {
      batchSize = 4;
    }
    var pathways = fs.readdirSync('./test/input-data/protocol').filter(function(fileName) {
      return fileName.indexOf('gpml') > -1;
    }).map(function(pathwayFileName) {
      var pathway = {};
      pathway.name = pathwayFileName.replace('.gpml.xml', '').replace('.gpml', '');
      pathway.fileName = pathwayFileName;
      return pathway;
    }).map(function(pathway) {
      return JSON.stringify(pathway);
    });
    var pathwaysStream = highland(pathways);
    function mocha(opts) {
      var spawnMocha = new SpawnMocha(opts);
      var stream = through(function write(file) {
        spawnMocha.add(file.path);
      }, function() {});
      var errors = [];
      spawnMocha.on('error', function(err) {
        console.error(err.toString());
        errors.push(err);
      }).on('end', function() {
        if (errors.length > 0) {
          console.error('ERROR SUMMARY: ');
          _(errors).each(function(err) {
            console.error(err.toString());
          });
          stream.emit('error', "Some tests failed.");
        }
        stream.emit('end');
      });
      return stream;
    }
    function buildMochaOpts(opts) {
      var mochaOpts = {
        flags: {
          u: 'bdd-with-opts',
          R: 'spec',
          b: true,
          t: 6000,
          c: true,
          debug: true
        },
        bin: path.join('./node_modules/mocha/bin/mocha'),
        concurrency: args.concurrency | process.env.CONCURRENCY || 3
      };
      if (args.grep) {
        mochaOpts.flags.g = args.grep;
      }
      mochaOpts.env = function() {
        var env = _.clone(process.env);
        env.PVJS_PATHWAY = opts.pathway;
        if (opts.unit) {
          delete env.SAUCE;
          delete env.SAUCE_USERNAME;
          delete env.SAUCE_ACCESS_KEY;
        } else {
          env.BROWSER = opts.browser;
          env.SAUCE = args.sauce;
        }
        if (opts.midway) {
          env.EXPRESS_PORT = expressPort;
        }
        return env;
      };
      return mochaOpts;
    }
    function runBrowsers(pathway) {
      return highland(args.browsers).map(function(browser) {
        var opts = {};
        opts.midway = true;
        opts.browser = browser;
        opts.pathway = pathway;
        return opts;
      }).map(buildMochaOpts).each(runLocalhostTest);
    }
    function runLocalhostTest(opts) {
      return gulp.src(['./test/tests/localhost.js'], {
        read: false,
        globals: []
      }).pipe(mocha(opts)).on('error', function() {
        pathwaysStream.destroy();
        console.log('Destroyed stream due to error.');
        selenium.kill();
      }).on('end', function() {
        browsersCompletedCount += 1;
        if (browsersCompletedCount === args.browsers.length) {
          browsersCompletedCount = 0;
          pathwayIndexOneBased += 1;
          if (pathwayIndexOneBased < pathways.length && (pathwayIndexOneBased % batchSize === 0)) {
            setTimeout(function() {
              pathwaysStream.resume();
            }, 3000);
          } else if (pathwayIndexOneBased === pathways.length) {
            console.log('Completed all tests requested.');
            setTimeout(function() {
              selenium.kill();
              process.exit();
            }, 2000);
          }
        }
      });
    }
    pathwaysStream.batch(batchSize).map(function(pathwayBatch) {
      pathwaysStream.pause();
      if (!!selenium) {
        selenium.kill();
      }
      return pathwayBatch;
    }).pipe(through(function(pathwayBatch) {
      seleniumLauncher(function(err, seleniumInstance) {
        selenium = seleniumInstance;
        process.env.SELENIUM_PORT = selenium.port;
        return highland(pathwayBatch).each(runBrowsers);
      });
    }));
  });
})(require("process"));
