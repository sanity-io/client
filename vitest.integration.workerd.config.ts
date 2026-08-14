// The live suite runs against the BUILT package through the real `exports` map, so it
// verifies both that the runtime's resolved entry loads and that the API still speaks
// our protocol. Deliberately does NOT spread `sharedConfig` and does NOT use
// `sourceAlias`: `sharedConfig` carries `setupFiles: ['./test/helpers/setupMockFetch.ts']`,
// which would install a fetch mock into this suite and silently defeat the entire point
// of it.
//
// Requires `pnpm build` first, and network access to api.sanity.io - this is the only
// suite in the repo that touches the real API. Run on a schedule and on version PRs,
// not on every PR.
//
// The cloudflare pool resolves through the real `exports` map and, like wrangler,
// excludes the `node` condition - so this needs no alias at all to faithfully exercise
// the fetch entry (see `test/exports.test.ts` for the resolution guard this mirrors).
import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // `compatibilityDate` is required or workerd will not start.
        // `nodejs_compat` is deliberately omitted, matching `vitest.workerd.config.ts`.
        compatibilityDate: '2024-09-23',
        compatibilityFlags: [],
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    // Same values, and the same reasoning, as `vitest.integration.config.ts`:
    // read the comment there. They are repeated rather than imported because
    // this config deliberately shares nothing with the others. Without them the
    // suite inherits vitest's 5s default, which is shorter than a single real
    // Media Library upload or release lifecycle takes.
    testTimeout: 60_000,
    slowTestThreshold: 20_000,
  },
})
