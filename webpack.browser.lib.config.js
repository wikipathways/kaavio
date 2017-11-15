const path = require("path");
const webpack = require("webpack");

const webpackConfig = require("./webpack.base-nobabel.config");

webpackConfig.entry = path.resolve(__dirname, "src/index.ts");
webpackConfig.output = {
  path: path.resolve(__dirname, "lib"),
  filename: "index.js"
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
    "process.env.NODE_ENV": JSON.stringify("production")
  })
].forEach(function(plugin) {
  webpackConfig.plugins.push(plugin);
});

module.exports = webpackConfig;
