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

webpackConfig.devtool = "inline-source-map";

[
  {
    test: require.resolve("react"),
    use: [
      {
        loader: "expose-loader",
        options: "React"
      }
    ]
  },
  {
    test: require.resolve("react-dom"),
    use: [
      {
        loader: "expose-loader",
        options: "ReactDOM"
      }
    ]
  }
].forEach(function(loader) {
  webpackConfig.module.rules.push(loader);
});

[
  (
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("dev")
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: false,
      debug: true
    })
  )
].forEach(function(plugin) {
  webpackConfig.plugins.push(plugin);
});

module.exports = webpackConfig;
