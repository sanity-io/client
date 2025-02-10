// Runs typecheck tests with Next.js App Router typings for fetch `cache`, `next.revalidate` and `next.tags` typings

import {configDefaults, defineConfig, mergeConfig} from 'vitest/config'

import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Only run tests in the text-next directory
      exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**'],
      typecheck: {
        enabled: true,
        tsconfig: 'test-next/tsconfig.json',
        exclude: ['test/**'],
      },
    },
  }),
)
