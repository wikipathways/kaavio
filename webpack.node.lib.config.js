const _ = require("lodash");
const path = require("path");
const webpack = require("webpack");

const webpackConfig = require("./webpack.base-nobabel.config");

webpackConfig.entry = {
  cli: "./src/cli.tsx",
  createJson2SvgCLI: "./src/createJson2SvgCLI.tsx"
};
webpackConfig.output = {
  filename: "[name].js",
  path: __dirname + "/lib",
  library: "[name]",
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
  })
].forEach(function(plugin) {
  webpackConfig.plugins.push(plugin);
});

module.exports = webpackConfig;
