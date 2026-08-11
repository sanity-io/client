// Typecheck-only suite: Next.js App Router typings for fetch `cache`,
// `next.revalidate` and `next.tags`.
import {configDefaults, defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Only run tests in the test-next directory
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**'],
    typecheck: {enabled: true, tsconfig: 'test-next/tsconfig.json', exclude: ['test/**']},
  },
})
