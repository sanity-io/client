// Default config: Node globals, runs against source so no build is required.
import {configDefaults, defineConfig, type ViteUserConfig} from 'vitest/config'

import pkg from './package.json' with {type: 'json'}

/** Suites that must not run under the source-alias configs. */
export const baseExclude = [
  ...configDefaults.exclude,
  // Selects by the `.integration.test.ts` suffix, not by directory, matching
  // `vitest.integration.config.ts`'s `include` - so this keeps excluding the
  // integration smoke suite even if a file ever lands outside `test/integration/`.
  'test/**/*.integration.test.ts',
  'test/packaging/**',
  'test/next/**',
]

/**
 * Non-Node environments additionally skip tests that need Node APIs by nature.
 * Matches nothing until Phase 3 introduces the first `*.node.test.ts`; the
 * mechanism deliberately lands before it is used.
 */
export const nonNodeExclude = [...baseExclude, 'test/**/*.node.test.ts']

/**
 * `*.browser.test.ts` files prove a subset of behaviour by talking to a real
 * server through `XMLHttpRequest`.
 */
export const browserOnlyExclude = ['test/**/*.browser.test.ts']

/**
 * Resolves the `@sanity/client` specifiers to source, reading `pkg.exports` so
 * the aliases cannot drift from the real map. `'node'` picks the undici-backed
 * Node build; `'default'` picks the platform-neutral fetch build that browser,
 * edge, worker and react-server environments resolve.
 */
export function sourceAlias(entry: 'default' | 'node'): Record<string, string> {
  const main = entry === 'node' ? pkg.exports['.'].node.source : pkg.exports['.'].source
  return {
    '@sanity/client/csm': new URL(pkg.exports['./csm'].source, import.meta.url).pathname,
    '@sanity/client/stega': new URL(pkg.exports['./stega'].source, import.meta.url).pathname,
    '@sanity/client': new URL(main, import.meta.url).pathname,
  }
}

export const sharedConfig = {
  exclude: baseExclude,
  setupFiles: ['./test/helpers/setupMockFetch.ts'],
  reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
} satisfies ViteUserConfig['test']

/**
 * This has to be spread explicitly by each config rather than inherited,
 * because vitest resolves each config file independently.
 */
export const coverageConfig = {
  provider: 'v8',
  reporter: ['text', 'html', 'json', 'json-summary'],
  include: ['src/**'],
  exclude: ['dist/**', 'node_modules/**', 'test/**'],
  excludeAfterRemap: true,
  reportOnFailure: true,
  clean: true,
} satisfies NonNullable<ViteUserConfig['test']>['coverage']

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...baseExclude, ...browserOnlyExclude],
    alias: sourceAlias('node'),
    typecheck: {
      enabled: true,
      // `typecheck.exclude` does not inherit `test.exclude`, and the packaging
      // suite's type tests resolve `@sanity/client` to `dist/`, so they only
      // run via `test:packaging`.
      exclude: [...configDefaults.typecheck.exclude, 'test/packaging/**'],
    },
    coverage: coverageConfig,
  },
})
