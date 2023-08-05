import {defineConfig} from 'vitest/config'

import pkg from './package.json'
import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    alias: {
      '@sanity/client': pkg.exports['.']['react-server'],
    },
  },
  resolve: {
    conditions: ['react-server', 'node'],
  },
})
