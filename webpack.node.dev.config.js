const _ = require("lodash");
const path = require("path");
const webpack = require("webpack");

const webpackConfig = require("./webpack.base.config");

webpackConfig.entry = {
  cli: "./src/cli.tsx",
  json2svgForTesting: "./src/json2svgForTesting.tsx",
  createJson2SvgCLI: "./src/createJson2SvgCLI.tsx"
};
webpackConfig.output = {
  filename: "[name].js",
  path: __dirname + "/dist",
  libraryTarget: "commonjs2"
};
webpackConfig.target = "node";
webpackConfig.node = {
  __dirname: false
};

webpackConfig.devtool = "source-map";

[
  new webpack.DefinePlugin({
    "process.env.NODE_ENV": JSON.stringify("dev")
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
