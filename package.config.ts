import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/index.browser.native.ts',
      import: './dist/index.browser.native.mjs',
      require: './dist/index.browser.native.cjs',
      runtime: 'browser',
    },
  ],
  // external: (prev) => [...prev, 'url-search-params-polyfill'],
  extract: {
    rules: {
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
    },
  },
})
