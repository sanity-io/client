/* eslint-disable @typescript-eslint/no-var-requires */
const nodeResolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
  input: 'dist/index.browser.js',
  output: {
    file: 'umd/sanityClient.js',
    format: 'umd',
    name: 'SanityClient',
    dynamicImportInCjs: false,
    inlineDynamicImports: true,
  },
  plugins: [nodeResolve({browser: true}), commonjs()],
}
