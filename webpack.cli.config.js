const _ = require("lodash");
const path = require("path");
const webpack = require("webpack");

const webpackConfig = require("./webpack.base.config");

webpackConfig.entry = "./src/cli.tsx";
webpackConfig.output = {
  path: path.resolve(__dirname, "dist"),
  filename: "cli.js",
  libraryTarget: "commonjs2"
};
webpackConfig.target = "node";
webpackConfig.node = {
  __dirname: false
};

module.exports = webpackConfig;
