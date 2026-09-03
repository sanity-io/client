// Runs typecheck tests against the BUILT declaration files (dist/*.d.ts), the way a consumer sees
// them. Requires `npm run build` first; a missing `dist/` is a failure here, not something to skip.
//
// Deliberately not merged with vite.config.ts: `mergeConfig` concatenates arrays, so the base
// config's `typecheck.exclude` entry for `test-dist/**` (which keeps this suite out of the default
// run) would carry over and exclude wins over include, leaving this suite with no tests.

import {configDefaults, defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Only run tests in the test-dist directory
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**', 'test-next/**'],
    typecheck: {
      enabled: true,
      tsconfig: 'test-dist/tsconfig.json',
      include: ['test-dist/**/*.test-d.ts'],
    },
  },
})
