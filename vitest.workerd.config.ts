// Runs the shared test suite inside Cloudflare's workerd runtime (via
// miniflare), deliberately WITHOUT the `nodejs_compat` flag: anything that
// can only resolve via the `node` condition, or reaches for a `node:*` API
// (including get-it's Node/undici build), fails here - which is the point.

import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import {browserOnlyExclude, nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      // Note: no `nodejs_compat` - we want cloudflare workers to function
      // without any compatibility with it. We do need a compatiblity date for
      // eventsource to not throw.
      miniflare: {compatibilityDate: '2024-11-11'},
    }),
  ],
  test: {
    ...sharedConfig,
    exclude: [...nonNodeExclude, ...browserOnlyExclude],
    alias: sourceAlias('default'),
  },
  ssr: {
    resolve: {
      conditions: ['workerd', 'worker', 'browser', 'module', 'import'],
    },
  },
})
