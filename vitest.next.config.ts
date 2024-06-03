// Runs typecheck tests with Next.js App Router typings for fetch `cache`, `next.revalidate` and `next.tags` typings

import {configDefaults, defineConfig} from 'vitest/config'

import {sharedConfig} from './vite.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    // Only run tests in the text-next directory
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**'],
    typecheck: {
      enabled: true,
      tsconfig: 'test-next/tsconfig.json',
      exclude: ['test/**'],
    },
  },
})
