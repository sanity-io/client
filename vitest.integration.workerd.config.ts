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

import {integrationProvide} from './vitest.integration.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // `compatibilityDate` is required or workerd will not start.
        // `nodejs_compat` is deliberately omitted, matching `vitest.workerd.config.ts`.
        //
        // `2024-11-11` is the earliest date at which workerd implements the `cache` field
        // on a request init. `eventsource` sets `cache: 'no-store'` on every SSE
        // connection, and before that date workerd throws "The 'cache' field on
        // 'RequestInitializerDict' is not implemented" instead of ignoring it, so the
        // `listen()` and `live.events()` tests here could not connect. That is a real
        // constraint on Workers users, not a test artifact: a Worker pinned to an earlier
        // compatibility date cannot use either API. Same reasoning and same date as
        // `vitest.workerd.config.ts`; see the longer note there.
        compatibilityDate: '2024-11-11',
        compatibilityFlags: [],
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    // This suite's `SANITY_INTEGRATION_*` configuration, read from
    // `process.env` in `vitest.integration.config.ts` (which runs in Node,
    // where that works) and handed to the tests over `provide`/`inject`. This
    // config is *why* that indirection exists: `process.env` inside the
    // cloudflare pool is permanently empty, so reading it in the tests failed
    // every one of them here. See the comment on `integrationProvide` for what
    // else was tried and ruled out.
    //
    // Importing this one plain object does not break the "shares nothing with
    // the other configs" rule above. That rule exists because `sharedConfig`
    // carries the fetch-mock `setupFiles`, which must never reach this suite;
    // `integrationProvide` carries no `setupFiles` and cannot drag one in. It is
    // the same reasoning under which `vitest.integration.config.ts` imports
    // `coverageConfig` from `vitest.config.ts`. Do not read this as licence to
    // start spreading shared config in here.
    provide: integrationProvide,
    // Same values, and the same reasoning, as `vitest.integration.config.ts`:
    // read the comment there. They are repeated rather than imported because
    // this config deliberately shares nothing with the others. Without them the
    // suite inherits vitest's 5s default, which is shorter than a single real
    // Media Library upload or release lifecycle takes.
    testTimeout: 60_000,
    slowTestThreshold: 20_000,
  },
})
