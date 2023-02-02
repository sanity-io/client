// Run tests in the Vercel Edge Runtime, and using its resolution algorithm that
// chooses worker exports if they exist, if not it tries to look for browser exports.

import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    environment: 'edge-runtime',
    alias: {'@sanity/client': pkg.exports['.'].browser.source},
  },
  resolve: {
    conditions: ['worker', 'browser'],
  },
})
