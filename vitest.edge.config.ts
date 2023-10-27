// Run tests in the Vercel Edge Runtime, and using its resolution algorithm that
// chooses worker exports if they exist, if not it tries to look for browser exports.

import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'edge-runtime',
    alias: {
      '@sanity/client/csm': pkg.exports['./csm'].source,
      '@sanity/client/stega': pkg.exports['./stega'].browser.source,
      '@sanity/client': pkg.exports['.'].browser.source,
    },
  },
  resolve: {
    // https://github.com/vercel/next.js/blob/95322649ffb2ad0d6423481faed188dd7b1f7ff2/packages/next/src/build/webpack-config.ts#L1079-L1084
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
  },
})
