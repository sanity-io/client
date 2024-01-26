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
      '@sanity/client/csm': new URL(pkg.exports['./csm'].source, import.meta.url).pathname,
      '@sanity/client/stega': new URL(pkg.exports['./stega'].browser.source, import.meta.url)
        .pathname,
      '@sanity/client': new URL(pkg.exports['.'].browser.source, import.meta.url).pathname,
    },
    typecheck: {
      enabled: false,
    },
  },
  resolve: {
    // https://github.com/vercel/next.js/blob/95322649ffb2ad0d6423481faed188dd7b1f7ff2/packages/next/src/build/webpack-config.ts#L1079-L1084
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
  },
})
