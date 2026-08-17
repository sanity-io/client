// The packaging suite runs against the BUILT package (dist/, pkg.exports) to
// catch failure modes source-aliased tests structurally cannot see: chunk
// splicing between rollup passes, and CJS/require resolution.
//
// Requires `pnpm build` first. A missing `dist/` must fail loudly here, not
// skip silently - unlike the source-aliased suites, this one has no source
// to fall back to.
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/packaging/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
  },
})
