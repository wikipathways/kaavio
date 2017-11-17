const _ = require("lodash");
const path = require("path");
const webpack = require("webpack");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");

const webpackConfig = require("./webpack.base.config");

webpackConfig.entry = {
  cli: "./src/cli.tsx",
  createJson2SvgCLI: "./src/createJson2SvgCLI.tsx"
};
webpackConfig.output = {
  filename: "[name].js",
  path: __dirname + "/dist",
  library: "[name]",
  //library: "Kaavio",
  libraryTarget: "umd"
};

webpackConfig.target = "node";
webpackConfig.node = {
  __dirname: false
};

webpackConfig.devtool = "source-map";

[
  new webpack.DefinePlugin({
    "process.env.NODE_ENV": JSON.stringify("production")
  }),
  new webpack.BannerPlugin({
    banner: "require('source-map-support').install();",
    //entryOnly: true,
    raw: true
  }),
  new UglifyJsPlugin({
    sourceMap: true,
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
].forEach(function(plugin) {
  webpackConfig.plugins.push(plugin);
});

module.exports = webpackConfig;
