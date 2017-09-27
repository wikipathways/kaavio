const webpack = require("webpack");
const path = require("path");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
//const tsconfig = require("./tsconfig.json");
//const babelrc = require(".babelrc");

const babelLoader = {
  loader: "babel-loader",
  options: { presets: ["env", "react"] }
};
//{ loader: "babel-loader", options: { presets: ["env"] } }
//{ loader: "babel-loader", options: { presets: babelrc.presets } }
//{ loader: "babel-loader" }

module.exports = {
  entry: "./src/index.ts",
  //entry: "./lib/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    library: "Kaavio",
    libraryTarget: "umd"
  },
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
    //modules: [path.join(__dirname, "src"), "node_modules"]
    //modules: [path.join(__dirname, "lib"), "node_modules"]
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
        test: /\.ts(x?)$/,
        //include: [path.resolve(__dirname, "lib/")],
        use: [
          babelLoader,
          {
            //loader: "ts-loader?" + JSON.stringify(tsconfig)
            loader: "ts-loader"
          }
        ]
      },
      {
        test: /\.js(x?)$/,
        use: [babelLoader]
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
    }),
    new ExtractTextPlugin({
      filename: "style.css",
      allChunks: true
    })
  ]
};
