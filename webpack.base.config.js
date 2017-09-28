const path = require("path");
const webpack = require("webpack");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");

const babelLoader = {
  loader: "babel-loader",
  options: { presets: ["env", "react"] }
};

const shebangRemovalLoader = {
  loader: StringReplacePlugin.replace({
    replacements: [
      {
        pattern: /^#!.*$/m,
        replacement: function(match, p1, offset, string) {
          return "";
        }
      }
    ]
  })
};

module.exports = {
  context: path.resolve(__dirname),
  devtool: "source-map",
  resolve: {
    extensions: [
      ".webpack.js",
      ".web.js",
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json"
    ]
  },
  module: {
    rules: [
      // Create an external stylesheet rather than inlined to support Angular CLI users
      // In Angular CLI, all styles must be specified in the styles property of a component
      // See: https://github.com/angular/angular-cli/issues/1459
      // Note: the typestyles will still be imported fine since they are not css files
      // Angular CLI users should add 'dist/style.css' into their component styles
      // TODO: Add an example of this in the README
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          use: ["css-loader", "postcss-loader"]
        })
      },
      { test: /\.json$/, use: "json-loader" },
      {
        test: /\.tsx?$/,
        use: [
          babelLoader,
          shebangRemovalLoader,
          {
            loader: "ts-loader"
          }
        ]
      },
      {
        test: /\.jsx?$/,
        use: [babelLoader, shebangRemovalLoader]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production")
    }),
    new webpack.LoaderOptionsPlugin({
      //minimize: true,
      debug: false
    }),
    new ExtractTextPlugin({
      filename: "style.css",
      allChunks: true
    }),
    new webpack.BannerPlugin({
      banner: "require('source-map-support').install();",
      //entryOnly: true,
      raw: true
    })
  ]
};
