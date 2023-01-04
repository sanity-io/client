const nodeResolve = require('@rollup/plugin-node-resolve')
const commonjs = require('@rollup/plugin-commonjs')

module.exports = {
  input: 'src/sanityClient.js',
  output: {
    dir: 'umd',
    format: 'umd',
    name: 'SanityClient',
  },
  plugins: [nodeResolve({browser: true}), commonjs()],
}
