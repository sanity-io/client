// This suite is a set of minimal, per-feature integration smoke tests (see
// CONTRIBUTING.md, "Integration smoke tests"), run against the BUILT package
// through the real `exports` map - so it verifies both that the runtime's
// resolved entry loads and that the API still speaks our protocol. No source
// alias and no `sharedConfig`: that is deliberate. `sharedConfig` carries
// `setupFiles: ['./test/helpers/setupMockFetch.ts']`, which would install a
// fetch mock here and defeat the entire point of this suite.
//
// Requires `pnpm build` first, and network access to api.sanity.io - this is
// the only suite in the repo that touches the real API. Run on a schedule and
// on version PRs, not on every PR.
//
// Selected by the `.integration.test.ts` suffix, not by directory, so the
// glob keeps working if a file ever needs to live outside `test/integration/`.
import {defineConfig} from 'vitest/config'

/**
 * The environment the integration suite reads its configuration from.
 *
 * Every value is a string, and an empty string means "not set" - see
 * {@link integrationProvide} for why they are not read from `process.env` in
 * the tests themselves.
 */
export interface IntegrationEnv {
  SANITY_INTEGRATION_TOKEN: string
  SANITY_INTEGRATION_ORG_TOKEN: string
  SANITY_INTEGRATION_PROJECT_ID: string
  SANITY_INTEGRATION_DATASET: string
  SANITY_INTEGRATION_MEDIA_LIBRARY_ID: string
  SANITY_INTEGRATION_VIDEO_ASSET_ID: string
}

declare module 'vitest' {
  interface ProvidedContext {
    integrationEnv: IntegrationEnv
  }
}

/**
 * Suite configuration read here, in the config, and handed to the tests over
 * vitest's `provide`/`inject` channel rather than read from `process.env` by
 * the tests themselves.
 *
 * The reason is workerd. Under `@cloudflare/vitest-pool-workers`, `process.env`
 * exists inside the worker but is permanently empty, so every test in this
 * suite failed there with "SANITY_INTEGRATION_TOKEN is not set" while passing
 * on the other four runtimes. Ruled out empirically before landing this:
 * miniflare `bindings` (they surface via `cloudflare:test`'s `env`, a
 * workerd-only import that has no business in shared helpers, and never reach
 * `process.env`), `define: {'process.env': ...}` (not forwarded to the workers
 * pool transform), and both of those combined with
 * `compatibilityFlags: ['nodejs_compat']` (still empty, and that flag is
 * deliberately omitted here to mirror real Workers). Do not retry them.
 *
 * `provide`/`inject` does reach the pool, including from module top level, and
 * is already how `globalSetup.upload.ts` gets the upload server URL across a
 * process boundary. Config files run in Node, where `process.env` works, so the
 * documented `SANITY_INTEGRATION_*` variables keep working exactly as before.
 *
 * Applied to all five runtimes rather than only workerd: a runtime-specific
 * branch in the helpers would mean four runtimes exercise a different code path
 * from the fifth, which is how this stayed broken in the first place.
 */
export const integrationProvide = {
  integrationEnv: {
    SANITY_INTEGRATION_TOKEN: process.env.SANITY_INTEGRATION_TOKEN ?? '',
    SANITY_INTEGRATION_ORG_TOKEN: process.env.SANITY_INTEGRATION_ORG_TOKEN ?? '',
    SANITY_INTEGRATION_PROJECT_ID: process.env.SANITY_INTEGRATION_PROJECT_ID ?? '',
    SANITY_INTEGRATION_DATASET: process.env.SANITY_INTEGRATION_DATASET ?? '',
    SANITY_INTEGRATION_MEDIA_LIBRARY_ID: process.env.SANITY_INTEGRATION_MEDIA_LIBRARY_ID ?? '',
    SANITY_INTEGRATION_VIDEO_ASSET_ID: process.env.SANITY_INTEGRATION_VIDEO_ASSET_ID ?? '',
  },
} satisfies {integrationEnv: IntegrationEnv}

export default defineConfig({
  test: {
    provide: integrationProvide,
    // NOT the shared `coverageConfig`, which would report 0% for every file
    // here. This suite executes `dist/` through the real `exports` map, not
    // `src/`, so its coverage arrives keyed by `dist/*.js` and only becomes
    // `src/*.ts` after being remapped through the build's source maps.
    //
    // Both halves of the shared config are matched against the pre-remap path,
    // so both discard exactly the data we want: `include: ['src/**']` drops the
    // `dist` entries (while still listing every `src` file, which is what makes
    // the report read as a uniform 0% rather than as empty), and
    // `exclude: ['dist/**']` drops them too. Verified by probing: with both
    // removed, a single test file reports ~27% and `src/config.ts` shows real
    // hits. So this is exclusion-only, and deliberately does not exclude
    // `dist`.
    //
    // `rolldown-runtime` is the one `dist` file with no source map, so it can
    // never be attributed back to source and is excluded by name rather than
    // left in the report as a meaningless row.
    //
    // These numbers are not comparable with the other suites': they measure the
    // bundled output's statements, not the source's.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      exclude: ['node_modules/**', 'test/**', 'dist/rolldown-runtime-*.js'],
      excludeAfterRemap: false,
      reportOnFailure: true,
      clean: true,
    },
    include: ['test/**/*.integration.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',

    // Real network calls need more headroom than the offline suites' defaults.
    // Measured across two developer machines, these tests run from ~100ms (a
    // bare SSE connect) to 7-12s for the Media Library lifecycle (upload, read
    // back, two deletes) - the same test, varying by a factor of ~1.7 with
    // location and network alone. The ceiling is set well above that rather
    // than snugly, because the things
    // that push a test past it are not proportional to its normal duration:
    //
    //   - Agent Actions calls a model, so its floor is inference latency
    //     rather than network round trips. This is why the ceiling is 60s and
    //     not 30s; it previously carried its own inline 60s override, now
    //     redundant.
    //   - `fetchUntilVisible()` (see `test/integration/helpers.ts`) will poll
    //     for up to 15s waiting on query-index lag, on top of the surrounding
    //     create and delete.
    //   - CI runners are slower than a developer machine, and this suite runs
    //     across five runtimes.
    //
    // A generous ceiling costs nothing when tests pass and only delays the
    // report when one hangs. Flaking on a timeout in a suite that talks to a
    // live API costs far more, since it trains people to re-run rather than
    // read the failure.
    testTimeout: 60_000,

    // Vitest flags any test slower than this in yellow, then red. The default
    // (300ms) is calibrated for offline unit tests and marks literally every
    // test in this suite, which is noise: a test here is *expected* to make
    // real network round trips. Set above the slowest observed run (12s, not
    // the 7s the same test takes elsewhere) so that normal variation between
    // machines and CI runners does not trip it. Below ~15s and this would
    // highlight the Media Library test on some machines and not others, which
    // teaches people to ignore the colour. Unlike `testTimeout`, this is
    // cosmetic and never fails a test.
    slowTestThreshold: 20_000,
  },
})
