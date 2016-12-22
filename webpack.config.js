const Dotenv = require('dotenv-webpack');

const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path'),
      join = path.join,
      resolve = path.resolve;

  const root = resolve(__dirname);
  const dest = join(root, 'public');

/*
* Default webpack configuration for development
*/
var config = {
  devtool: '#eval-source-map',
  entry:  ['whatwg-fetch', './src/index.js'],

  output: {
    path: dest,
    filename: 'bundle.js'
  },

  module: {
    loaders: [{
      test: /\.js?$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel',
      query: {
        presets: ['stage-2','es2015'],
        plugins: ['transform-class-properties', 'transform-object-rest-spread', 'transform-function-bind']
      }
    }],

  },

  plugins: [
    new CopyWebpackPlugin([
      { from: join(root, 'index.html') },
      { from: join(root, 'rezultate'), to: 'rezultate' }
    ]),
    new Dotenv({
      path: './.env', // if not simply .env
      safe: false // lets load the .env.example file as well
    })
  ],

  node: {
    console: true,
    fs: 'empty'
  },

  devServer: {
    contentBase: './',
    colors: true,
    historyApiFallback: true,
    inline: true,
    outputPath: __dirname
  }
}

/*
* If bundling for production, optimize output
*/
if (process.env.NODE_ENV === 'production') {
  config.devtool = false;
  config.plugins = [
    new webpack.optimize.OccurenceOrderPlugin(),
    new webpack.optimize.UglifyJsPlugin({comments: false}),
    new webpack.DefinePlugin({
      'process.env': {NODE_ENV: JSON.stringify('production')}
    })
  ];
}

module.exports = config;
