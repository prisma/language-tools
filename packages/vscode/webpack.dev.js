const { merge } = require('webpack-merge') // eslint-disable-line
const common = require('./webpack.common.js') // eslint-disable-line

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
  },
})
