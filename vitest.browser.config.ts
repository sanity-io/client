// Simulates a browser environment until `@vitest/browser` is ready for production and
// we can run the tests in a real browser

import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'happy-dom',
    alias: {
      '@sanity/client/csm': pkg.exports['./csm'].source,
      '@sanity/client/stega': pkg.exports['./stega'].browser.source,
      '@sanity/client': pkg.exports['.'].browser.source,
    },
  },
  resolve: {
    conditions: ['browser', 'module', 'import'],
  },
})
