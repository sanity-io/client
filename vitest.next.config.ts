// Run tests in the Vercel Edge Runtime, and using its resolution algorithm that
// chooses worker exports if they exist, if not it tries to look for browser exports.

import {configDefaults, defineConfig} from 'vitest/config'

import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    // Only run tests in the text-next directory
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**'],
    typecheck: {
      tsconfig: 'test-next/tsconfig.json',
      exclude: ['test/**'],
    },
  },
})
