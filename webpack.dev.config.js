const _ = require("lodash");
const path = require("path");
const webpackConfig = require("./webpack.base.config");

//webpackConfig.entry = "./src/cli.tsx";
webpackConfig.entry = "./src/dummy.ts";
webpackConfig.output = {
  path: path.resolve(__dirname, "lib"),
  filename: "[name].js",
  libraryTarget: "commonjs2"
};
webpackConfig.target = "node";
webpackConfig.watch = true;
webpackConfig.node = {
  __dirname: false
};

module.exports = webpackConfig;
