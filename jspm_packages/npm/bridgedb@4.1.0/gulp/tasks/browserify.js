/* */ 
var brfs = require("gulp-brfs");
var browserify = require("browserify");
var buffer = require("vinyl-buffer");
var bundleLogger = require("../util/bundleLogger");
var gulp = require("gulp");
var handleErrors = require("../util/handleErrors");
var source = require("vinyl-source-stream");
var sourcemaps = require("gulp-sourcemaps");
var uglify = require("gulp-uglify");
var watchify = require("watchify");
gulp.task('browserify', function() {
  var bundleMethod = global.isWatching ? watchify : browserify;
  var getBundleName = function() {
    var version = global.newPackageJson.version;
    console.log('version');
    console.log(version);
    var name = global.newPackageJson.name;
    return name + '-' + version + '.' + 'min';
  };
  var bundler = bundleMethod({
    cache: {},
    packageCache: {},
    fullPaths: true,
    entries: ['./index.js'],
    debug: true
  });
  var bundle = function() {
    bundleLogger.start();
    return bundler.bundle().on('error', handleErrors).pipe(source(getBundleName() + '.js')).pipe(buffer()).pipe(uglify()).pipe(sourcemaps.init({loadMaps: true})).pipe(sourcemaps.write('./')).pipe(gulp.dest('./dist/')).on('end', bundleLogger.end);
  };
  if (global.isWatching) {
    bundler = watchify(bundler);
    bundler.on('update', bundle);
  }
  return bundle();
});
