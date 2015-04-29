var fs = require('fs');
var git = require('gulp-git');
var gitStreaming = require('../util/gitStreaming.js');
var gulp = require('gulp');
var highland = require('highland');
// TODO don't repeat these
var metadataFilePaths = require('../util/metadataFilePaths.json');

gulp.task('bumpGitTag', function bumpGitTag(callback) {
  var package = JSON.parse(fs.readFileSync('package.json'));
  var version = package.version;

  gitStreaming.readTags
  .reduce(false, function checkTagExists(accumulator, tag) {
    if (accumulator || (tag === version)) {
      return true;
    }

    return false;
  })
  .each(function(tagExists) {
    if (tagExists) {
      return callback();
    }

    gulp.src(['./dist/*' + version + '*',
              './docs/*',
              'README.md']
              .concat(metadataFilePaths)
    )
    .pipe(git.add())
    .pipe(git.commit('Built and bumped version to ' + version + '.'))
    // TODO the tag happens before the commit! Need to make commit
    // happen first.
    .last()
    .pipe(gitStreaming.createTag(version, 'Version ' + version))
    .each(function() {
      return callback();
    });
  });
});
