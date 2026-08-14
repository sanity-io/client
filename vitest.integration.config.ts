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

export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    // Real network calls need more headroom than the hermetic suites' defaults.
    testTimeout: 30_000,
  },
})
