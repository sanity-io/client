// Runs typecheck tests against the BUILT declaration files (dist/*.d.ts), the way a consumer sees
// them. Requires `npm run build` first; a missing `dist/` is a failure here, not something to skip.

import {configDefaults, defineConfig, mergeConfig} from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Only run tests in the test-dist directory
      exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**', 'test-next/**'],
      typecheck: {
        enabled: true,
        tsconfig: 'test-dist/tsconfig.json',
        include: ['test-dist/**/*.test-d.ts'],
      },
    },
  }),
)
