const path = require("path");
const webpack = require("webpack");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");
const npmPkg = require("./package.json");

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
  entry: {
    "kaavio.dummy": ["babel-polyfill", "./test/kaavio.dummy.js"]
    //"kaavio.vanilla": ["babel-polyfill", "./esnext/kaavio.vanilla.js"]
    /*
    "kaavio.jquery": ["babel-polyfill", "./esnext/kaavio.jquery.js"]
    "wikipathways-kaavio.webcomponent": [
      "babel-polyfill",
      "./esnext/wikipathways-kaavio.webcomponent.js"
    ]
    //*/
    //"Kaavio": ["babel-polyfill", "./esnext/Kaavio.js"],
    //cli: ["babel-polyfill", "./esnext/cli.js"]
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    library: "Kaavio",
    libraryExport: "Kaavio",
    libraryTarget: "umd"
  },
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
      /*
      // Create an external stylesheet rather than inlined to support Angular CLI users
      // In Angular CLI, all styles must be specified in the styles property of a component
      // See: https://github.com/angular/angular-cli/issues/1459
      // Note: the typestyles will still be imported fine since they are not css files
      // Angular CLI users should add 'dist/style.css' into their component styles
      // TODO: Add an example of this in the README
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: ExtractTextPlugin.extract({
          use: ["css-loader", "postcss-loader"]
        })
      },
      //*/
      /*
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "style-loader"
          },
          {
            loader: "css-loader",
            options: {
              importLoaders: 1
            }
          },
          {
            loader: "postcss-loader"
          }
        ]
      },
      //*/
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [{ loader: "to-string-loader" }, { loader: "css-loader" }]
      },
      {
        test: /\.json$/,
        exclude: /node_modules/,
        use: "json-loader"
      },
      {
        test: /\.[jt]sx?$/,
        use: ["source-map-loader", shebangRemovalLoader],
        enforce: "pre",
        exclude: [/lodash/, /react-dom/, /react-spinkit/]
      },
      {
        test: require.resolve("react-dom"),
        exclude: /node_modules/,
        use: [
          {
            loader: "expose-loader",
            options: "ReactDOM"
          }
        ]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      version: npmPkg.version
    }),
    new ExtractTextPlugin({
      filename: "style.css",
      allChunks: true
    })
  ]
};
