/* */ 
var fs = require("fs"),
    path = require("path");
var pkginfo = module.exports = function(pmodule, options) {
  var args = [].slice.call(arguments, 2).filter(function(arg) {
    return typeof arg === 'string';
  });
  if (Array.isArray(options)) {
    options = {include: options};
  } else if (typeof options === 'string') {
    options = {include: [options]};
  }
  options = options || {};
  options.include = options.include || [];
  if (args.length > 0) {
    options.include = options.include.concat(args);
  }
  var pkg = pkginfo.read(pmodule, options.dir).package;
  Object.keys(pkg).forEach(function(key) {
    if (options.include.length > 0 && !~options.include.indexOf(key)) {
      return ;
    }
    if (!pmodule.exports[key]) {
      pmodule.exports[key] = pkg[key];
    }
  });
  return pkginfo;
};
pkginfo.find = function(pmodule, dir) {
  if (!dir) {
    dir = path.dirname(pmodule.filename);
  }
  var files = fs.readdirSync(dir);
  if (~files.indexOf('package.json')) {
    return path.join(dir, 'package.json');
  }
  if (dir === '/') {
    throw new Error('Could not find package.json up from: ' + dir);
  } else if (!dir || dir === '.') {
    throw new Error('Cannot find package.json from unspecified directory');
  }
  return pkginfo.find(pmodule, path.dirname(dir));
};
pkginfo.read = function(pmodule, dir) {
  dir = pkginfo.find(pmodule, dir);
  var data = fs.readFileSync(dir).toString();
  return {
    dir: dir,
    package: JSON.parse(data)
  };
};
pkginfo(module, {
  dir: __dirname,
  include: ['version'],
  target: pkginfo
});
