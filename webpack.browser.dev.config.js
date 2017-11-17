const path = require("path");
const webpack = require("webpack");

const webpackConfig = require("./webpack.base.config");

webpackConfig.entry = path.resolve(__dirname, "src/index.ts");
webpackConfig.output = {
  path: path.resolve(__dirname, "dist"),
  filename: "index.js",
  library: "Kaavio",
  libraryTarget: "umd"
};

webpackConfig.module.rules.push({
  test: require.resolve("react-dom"),
  use: [
    {
      loader: "expose-loader",
      options: "ReactDOM"
    }
  ]
});

[
  new webpack.DefinePlugin({
    "process.env.NODE_ENV": JSON.stringify("dev")
  })
].forEach(function(plugin) {
  webpackConfig.plugins.push(plugin);
});

module.exports = webpackConfig;
