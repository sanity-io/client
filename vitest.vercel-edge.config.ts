// Vercel Edge Runtime, using its resolution order: worker exports if present,
// otherwise browser exports.
import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
    environment: 'edge-runtime',
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
  },
  resolve: {
    // https://github.com/vercel/next.js/blob/95322649/packages/next/src/build/webpack-config.ts#L1079-L1084
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
  },
})
