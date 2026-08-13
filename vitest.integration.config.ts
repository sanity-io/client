// The live suite runs against the BUILT package through the real `exports` map,
// so it verifies both that the runtime's resolved entry loads and that the API
// still speaks our protocol. No source alias: that is deliberate.
//
// Requires `pnpm build` first, and network access to api.sanity.io - this is
// the only suite in the repo that touches the real API. Run on a schedule and
// on version PRs, not on every PR.
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
  },
})
