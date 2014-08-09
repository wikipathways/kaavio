var gulp = require('gulp')
  , _ = require('lodash')
  , args   = require('yargs').argv
  , crypto = require('crypto')
  , fs   = require('fs')
  , highland = require('highland')
  , os   = require('os')
  , path = require('path')
  , through = require('through')
  ;

/* 
 * Warning! Only run this task after manually viewing every PNG
 * in the protocolTestResultsDirectory and verifying each one
 * is a correct rendering of the corresponding pathway.
 */

gulp.task('setLastKnownGoods', function () {
  var protocolTestResultsDirectory = './tmp/protocol/'
    , protocolTestLastKnownGoodsDirectory = './test/last-known-goods/protocol/'
    ;

  var testScreenshotFileNameStream = highland(fs.readdirSync(protocolTestResultsDirectory))
  .filter(function(fileName) {
    return fileName.indexOf('png') > -1 && fileName.indexOf('test') > -1;
  });

  var testScreenshotTagStream = testScreenshotFileNameStream.fork();
  var screenshotHashStream = testScreenshotFileNameStream.fork();
  
  // TODO figure out how to do this properly without redefining the variable
  var screenshotHashStream2 = screenshotHashStream.map(function(testScreenshotFileName) {
    var screenshotSourcePath = protocolTestResultsDirectory + testScreenshotFileName;
    // TODO look at using a perceptual image hash instead, like http://www.phash.org/
    var sha1Sum = crypto.createHash('sha1');
    var screenshotBufferStream = highland(fs.ReadStream(screenshotSourcePath));

    if (testScreenshotFileName.indexOf('phantomjs') > -1) {
      var screenshotDestinationPath = protocolTestLastKnownGoodsDirectory + testScreenshotFileName.replace('phantomjs-test', 'lkg');
      var dest = fs.createWriteStream(screenshotDestinationPath)
      screenshotBufferStream.fork().pipe(dest);
    }

    return screenshotBufferStream.fork().map(function(d) {
      sha1Sum.update(d);
      return;
    })
    .last()
    .map(function() {
      screenshotHashStream.resume();
      return sha1Sum.digest('hex');
    });
  })
  .sequence();

  var screenshotHashesDestination = fs.createWriteStream(protocolTestLastKnownGoodsDirectory + 'screenshot-hashes.json')

  testScreenshotTagStream.map(function(testScreenshotFileName) {
    var testScreenshotFileNameComponents = testScreenshotFileName.split('-');
    var testScreenshotFileNameComponentsLength = testScreenshotFileNameComponents.length;

    var browser = testScreenshotFileNameComponents[testScreenshotFileNameComponentsLength - 2];
    var type = testScreenshotFileNameComponents[testScreenshotFileNameComponentsLength - 1].replace('.png', '');
    var name = testScreenshotFileName.split('-' + browser)[0];

    var result = {
      browser: browser,
      type: type,
      name: name
    };
    testScreenshotTagStream.resume();
    return result;
  })
  .zip(screenshotHashStream2)
  .reduce({}, function(screenshotHashes, input) {
    // NOTE: we are setting a hash for every combination of these variables that we test:
    // test protocol pathway name, operating system + version, browser
    var testScreenshotTags = input[0];
    var browser = testScreenshotTags.browser;
    var type = testScreenshotTags.type;
    var name = testScreenshotTags.name;

    var screenshotHash = input[1];

    screenshotHashes[name] = screenshotHashes[name] || {};
    var operatingSystem = os.type() + os.release();
    screenshotHashes[name][operatingSystem] = screenshotHashes[name][operatingSystem] || {};
    screenshotHashes[name][operatingSystem][browser] = screenshotHash;
    return screenshotHashes;
  })
  .map(function(screenshotHashes) {
    return JSON.stringify(screenshotHashes, null, '\t')
  })
  .pipe(screenshotHashesDestination);
});

