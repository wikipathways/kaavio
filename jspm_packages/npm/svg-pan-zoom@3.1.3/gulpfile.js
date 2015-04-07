/* */ 
var gulp = require("gulp"),
    watch = require("gulp-watch"),
    uglify = require("gulp-uglify"),
    browserify = require("browserify"),
    source = require("vinyl-source-stream"),
    streamify = require("gulp-streamify"),
    rename = require("gulp-rename"),
    qunit = require("gulp-qunit"),
    jshint = require("gulp-jshint"),
    jscs = require("gulp-jscs"),
    sync = require("gulp-config-sync"),
    header = require("gulp-header"),
    pkg = require("./package.json!systemjs-json"),
    banner = "// svg-pan-zoom v<%= pkg.version %>" + "\n" + "// https://github.com/ariutta/svg-pan-zoom" + "\n";
;
gulp.task('browserify', function() {
  return browserify({entries: './src/stand-alone.js'}).bundle().on('error', function(err) {
    console.log(err.toString());
    this.emit("end");
  }).pipe(source('svg-pan-zoom.js')).pipe(header(banner, {pkg: pkg})).pipe(gulp.dest('./dist/')).pipe(streamify(rename('svg-pan-zoom.min.js'))).pipe(streamify(uglify())).pipe(header(banner, {pkg: pkg})).pipe(gulp.dest('./dist/'));
});
gulp.task('watch', function() {
  gulp.watch('./src/**/*.js', ['browserify']);
});
gulp.task('test', function() {
  gulp.src('./tests/index.html').pipe(qunit());
});
gulp.task('check', function() {
  gulp.src(['./src/*', '!./src/uniwheel.js']).pipe(jshint()).pipe(jshint.reporter('default')).pipe(jscs());
});
gulp.task('sync metadata', function() {
  gulp.src('./bower.json').pipe(sync({
    src: 'package.json',
    fields: ['name', 'version', {
      from: 'contributors',
      to: 'authors'
    }, 'description', 'main', 'keywords', 'licence']
  })).pipe(gulp.dest(''));
});
gulp.task('build', ['test', 'check', 'browserify', 'sync metadata']);
gulp.task('default', ['browserify', 'watch']);
