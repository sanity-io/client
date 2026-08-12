// Typecheck-only suite: Next.js App Router typings for fetch `cache`,
// `next.revalidate` and `next.tags`.
import {configDefaults, defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    // Only run tests in the test/next directory
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test/**'],
    // `typecheck.include`/`exclude` are a separate axis from the regular
    // `test.include`/`exclude` above (they govern which `*.test-d.ts` files
    // get type-checked, not executed) and default to every such file in the
    // repo - so this needs its own scoping to test/next, or every other
    // `*.test-d.ts` file gets swept in too.
    typecheck: {
      enabled: true,
      tsconfig: 'test/next/tsconfig.json',
      include: ['test/next/**/*.test-d.ts'],
    },
  },
})
