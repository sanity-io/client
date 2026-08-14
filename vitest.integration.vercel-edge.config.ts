// The live suite runs against the BUILT package through the real `exports` map, so it
// verifies both that the runtime's resolved entry loads and that the API still speaks
// our protocol. Deliberately does NOT spread `sharedConfig`: `sharedConfig` carries
// `setupFiles: ['./test/helpers/setupMockFetch.ts']`, which would install a fetch mock
// into this suite and silently defeat the entire point of it.
//
// Requires `pnpm build` first, and network access to api.sanity.io - this is the only
// suite in the repo that touches the real API. Run on a schedule and on version PRs,
// not on every PR.
//
// Unlike the workerd variant, this DOES need an explicit alias pinning `./dist/index.js`:
// Vite's own resolver runs in Node and always injects the `node` condition, so without
// the alias it could resolve the Node (undici) build instead of the fetch build the real
// Vercel Edge Runtime picks. `test/exports.test.ts` remains the faithful guard for
// *which* entry each condition set selects; this config only needs to pin the one
// Vercel Edge itself resolves.
//
// The build self-references its own subpaths (`dist/index.js` imports
// `@sanity/client/csm`, `dist/stega.js` imports `@sanity/client`). Node's own resolver
// handles that natively; Vite's does not, so every subpath needs pinning too, not just
// the main entry. Reads `pkg.exports` (as `sourceAlias` in `vitest.config.ts` does for
// the source paths) so these aliases cannot drift from the real map.
import {defineConfig} from 'vitest/config'

import pkg from './package.json' with {type: 'json'}

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    // Same values, and the same reasoning, as `vitest.integration.config.ts`:
    // read the comment there. They are repeated rather than imported because
    // this config deliberately shares nothing with the others. Without them the
    // suite inherits vitest's 5s default, which is shorter than a single real
    // Media Library upload or release lifecycle takes, so those tests fail here
    // on duration alone while passing everywhere else.
    testTimeout: 60_000,
    slowTestThreshold: 20_000,
    environment: 'edge-runtime',
    alias: {
      '@sanity/client/csm': new URL(pkg.exports['./csm'].default, import.meta.url).pathname,
      '@sanity/client/stega': new URL(pkg.exports['./stega'].default, import.meta.url).pathname,
      '@sanity/client': new URL(pkg.exports['.'].default, import.meta.url).pathname,
    },
  },
  resolve: {
    // Same condition set as `vitest.vercel-edge.config.ts`:
    // https://github.com/vercel/next.js/blob/95322649ffb2ad0d6423481faed188dd7b1f7ff2/packages/next/src/build/webpack-config.ts#L1079-L1084
    conditions: ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
  },
})
