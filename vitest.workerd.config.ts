// Runs a smoke suite inside Cloudflare's workerd runtime (via miniflare) to
// verify the client works *out of the box* on bare workerd — i.e. WITHOUT the
// `nodejs_compat` flag — so it never reaches for get-it's Node (undici) build
// or any `node:*` API.

import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import pkg from './package.json'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // Intentionally no `compatibilityFlags: ['nodejs_compat']` — the point
        // of this suite is to prove the client runs on a stock worker.
        compatibilityDate: '2024-09-23',
      },
    }),
  ],
  test: {
    include: ['runtimes/workerd/**/*.test.ts'],
    // Mirror the other runtime suites: resolve `@sanity/client` to source so we
    // don't depend on `npm run build`. The real `exports` map is exercised by
    // the packaging-resolution guard in `test/exports.test.ts` instead.
    alias: {
      '@sanity/client/csm': new URL(pkg.exports['./csm'].source, import.meta.url).pathname,
      '@sanity/client/stega': new URL(pkg.exports['./stega'].browser.source, import.meta.url)
        .pathname,
      '@sanity/client': new URL(pkg.exports['.'].browser.source, import.meta.url).pathname,
    },
    server: {
      deps: {
        // The pool externalizes deps and resolves them Node-side, where Node
        // always injects the `node` condition — so get-it would resolve its
        // Node (undici) build no matter what conditions are set here. Inline it
        // so Vite resolves it with the bare-worker conditions below instead.
        inline: [/get-it/],
      },
    },
  },
  ssr: {
    resolve: {
      // Model bare workerd: `node` is NOT active without `nodejs_compat`, so it
      // is deliberately omitted. Anything that can only resolve via `node` (or
      // needs a `node:*` API) will fail here — which is exactly what we want to
      // catch.
      conditions: ['workerd', 'worker', 'browser', 'module', 'import'],
    },
  },
})
