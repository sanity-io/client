import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import {sourceAlias} from './vitest.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      // Intentionally no `compatibilityFlags: ['nodejs_compat']` - the point of
      // this suite is to prove the client runs on a stock worker.
      miniflare: {compatibilityDate: '2024-09-23'},
    }),
  ],
  test: {
    include: ['runtimes/workerd/**/*.test.ts'],
    alias: sourceAlias('default'),
    server: {
      deps: {
        // The pool externalizes deps and resolves them Node-side, where Node always
        // injects the `node` condition - so get-it would resolve its undici build
        // regardless of the conditions below. Inline it so Vite resolves it with
        // the bare-worker conditions instead.
        inline: [/get-it/],
      },
    },
  },
  ssr: {
    resolve: {
      // Model bare workerd: `node` is NOT active without `nodejs_compat`, so it is
      // deliberately omitted. Anything resolvable only via `node` fails here,
      // which is the point.
      conditions: ['workerd', 'worker', 'browser', 'module', 'import'],
    },
  },
})
