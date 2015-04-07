/* */ 
(function(process) {
  var fs = require("fs");
  var onlyScripts = require("./util/scriptFilter");
  var tasks = fs.readdirSync('./gulp/tasks/').filter(onlyScripts);
  tasks.forEach(function(task) {
    require('./tasks/' + task);
  });
  var _ = require("lodash");
  var argv = require("yargs").argv;
  var exec = require("child_process").exec;
  var File = require("vinyl");
  var fs = require("vinyl-fs");
  var git = require("gulp-git");
  var gulp = require("gulp");
  var bump = require("gulp-bump");
  var highland = require("highland");
  var inquirer = require("inquirer");
  var jsdoc = require("gulp-jsdoc");
  var jsdocOptions = require("../jsdoc-conf.json!systemjs-json");
  var JSONStream = require("JSONStream");
  var nodeFs = require("fs");
  var rename = require("gulp-rename");
  var replace = require("gulp-regex-replace");
  var source = require("vinyl-source-stream");
  var createGitCheckoutStream = highland.wrapCallback(git.checkout);
  var createGitMergeStream = highland.wrapCallback(git.merge);
  var createGitPushStream = highland.wrapCallback(git.push);
  var createGitTagStream = highland.wrapCallback(git.tag);
  var createPromptStream = highland.wrapCallback(inquirer.prompt);
  var oldPackageJson = require("../package.json!systemjs-json");
  global.oldPackageJson = oldPackageJson;
  var newPackageJson = global.newPackageJson = oldPackageJson;
  var versionType;
  var metadataFiles = ['./bower.json', './component.json', './package.json'];
  gulp.task('build-docs', ['sync-readme-version'], function(callback) {
    exec('jsdoc -t "./node_modules/jaguarjs-jsdoc/" -c ' + '"./jsdoc-conf.json" "./lib/" -r "./README.md" -d "./docs/"', function(err, stdout, stderr) {
      console.log(stdout);
      console.log(stderr);
      return callback(err, stdout);
    });
  });
  gulp.task('sync-git-version', function bumpGit(callback) {
    if (newPackageJson.version === oldPackageJson.version) {
      return callback(null);
    }
    gulp.src(['./dist/*', './docs/*', 'README.md'].concat(metadataFiles)).pipe(git.add()).pipe(git.commit('Bump version to ' + newPackageJson.version + ' and build.')).pipe(createGitTagStream('v' + newPackageJson.version, 'Version ' + newPackageJson.version)).last().each(function(data) {
      return callback(null, data);
    });
  });
  gulp.task('bump-metadata-files', ['get-version-type'], function(callback) {
    gulp.src(metadataFiles).pipe(bump({type: versionType})).pipe(gulp.dest('./')).pipe(highland.pipeline(function(s) {
      return s.map(function(file) {
        return file.contents;
      }).pipe(JSONStream.parse()).pipe(highland.pipeline()).each(function(json) {
        newPackageJson = global.newPackageJson = json;
        return callback(null, json);
      });
    }));
  });
  gulp.task('sync-readme-version', function() {
    return gulp.src('README.md').pipe(replace({
      regex: oldPackageJson.version,
      replace: newPackageJson.version
    })).pipe(gulp.dest('./'));
  });
  gulp.task('get-version-type', function(callback) {
    highland(createPromptStream({
      type: 'list',
      name: 'versionType',
      message: 'Choose a version type below.',
      choices: ['patch', 'minor', 'major', 'prerelease']
    })).errors(function(err, push) {
      if (_.isPlainObject(err)) {
        push(null, err);
      } else {
        push(err);
      }
    }).last().each(function(res) {
      versionType = res.versionType;
      return callback(null, versionType);
    });
  });
  gulp.task('publish', ['sync-git-version'], function publish(callback) {
    highland(createGitPushStream('origin', 'master')).errors(killStream).flatMap(createGitPushStream('origin', 'v' + newPackageJson.version)).errors(killStream).flatMap(createGitCheckoutStream('gh-pages')).flatMap(createGitMergeStream('master')).flatMap(createGitPushStream('origin', 'gh-pages')).flatMap(createGitCheckoutStream('master')).flatMap(function() {
      return highland.wrapCallback(exec)('npm publish');
    }).map(function(stdout, stderr) {
      return stdout;
    }).each(function(data) {
      return callback(null, data);
    });
  });
  gulp.task('verify-git-status', function verifyGitStatus(callback) {
    var desiredBranch = 'master';
    highland([{}]).flatMap(highland.wrapCallback(git.status)).errors(killStream).map(function(stdout) {
      var inDesiredBranch = stdout.indexOf('On branch ' + desiredBranch) > -1;
      var nothingToCommit = stdout.indexOf('nothing to commit') > -1;
      var gitStatusOk = inDesiredBranch && nothingToCommit;
      if (!gitStatusOk) {
        var message = 'Please checkout master and ' + 'commit all changes before bumping.';
        throw new Error(message);
      }
      return stdout;
    }).errors(killStream).flatMap(highland.wrapCallback(function(data, callback) {
      git.exec({args: 'diff master origin/master'}, function(err, stdout) {
        return callback(null, stdout);
      });
    })).map(function(stdout) {
      var gitStatusOk = (stdout === '');
      if (!gitStatusOk) {
        var message = 'local/master is ahead of and/or behind origin/master.' + ' Please push/pull before bumping.';
        throw new Error(message);
      }
      return gitStatusOk;
    }).errors(killStream).each(function(gitStatusOk) {
      return callback(null, gitStatusOk);
    });
  });
  function killStream(err, push) {
    if (_.isString(err)) {
      err = new Error(err);
    } else if (_.isPlainObject(err)) {
      var jsError = new Error(err.msg || err.message || 'Error');
      _.assign(jsError, err);
      err = jsError;
    }
    process.exit(1);
  }
})(require("process"));
