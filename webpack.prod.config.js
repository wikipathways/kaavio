const path = require("path");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

const webpackConfig = require("./webpack.base.config");

webpackConfig.entry = "./src/index.ts";
webpackConfig.output = {
  path: path.resolve(__dirname, "dist"),
  filename: "index.js",
  library: "Kaavio",
  libraryTarget: "umd"
};

webpackConfig.plugins.push(
  new UglifyJsPlugin({
    beautify: false,
    ecma: "8",
    mangle: {
      screw_ie8: true,
      keep_fnames: true
    },
    compress: {
      screw_ie8: true
    },
    comments: false
  })
);

module.exports = webpackConfig;
