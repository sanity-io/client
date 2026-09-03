// The packaging suite runs against the BUILT package (dist/, pkg.exports) to
// catch failure modes source-aliased tests structurally cannot see: chunk
// splicing between rollup passes, CJS/require resolution, and the shape of the
// bundled declaration files.
//
// Requires `pnpm build` first. A missing `dist/` must fail loudly here, not
// skip silently - unlike the source-aliased suites, this one has no source
// to fall back to.
import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/packaging/**/*.test.ts'],
    // Type tests resolve `@sanity/client` to `dist/` through
    // test/packaging/tsconfig.json, so they see the bundled `.d.ts` files, not
    // the `src/` aliases the other suites typecheck against.
    typecheck: {
      enabled: true,
      tsconfig: 'test/packaging/tsconfig.json',
      include: ['test/packaging/**/*.test-d.ts'],
    },
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
  },
})
