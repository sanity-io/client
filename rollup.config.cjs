/* eslint-disable @typescript-eslint/no-var-requires */
const nodeResolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
  input: 'dist/index.browser.js',
  output: {
    file: 'umd/sanityClient.js',
    format: 'umd',
    name: 'SanityClient',
  },
  plugins: [nodeResolve({browser: true}), commonjs()],
}
