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
 * `*.browser.test.ts` files prove their behaviour by talking to a real server
 * through a real `XMLHttpRequest` - no faking the transport. That needs more
 * than the global merely existing:
 *
 * - Node and the edge-runtime environment have no `XMLHttpRequest` global at
 *   all.
 * - happy-dom does implement the global, but not the behaviour: verified
 *   empirically (a real happy-dom `XMLHttpRequest` against a real local
 *   server) that it never fires `xhr.upload.onprogress` and never fires
 *   `ontimeout` - so it can run the request but can't exercise either
 *   feature.
 *
 * All three exclude these files outright rather than skip individual tests
 * within them. Only real browsers (`vitest.browser.config.ts`) collect them.
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

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...baseExclude, ...browserOnlyExclude],
    alias: sourceAlias('node'),
    typecheck: {enabled: true},
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      include: ['src/**'],
      // Redundant against `include: ['src/**']` on its own, but stated so that
      // widening `include` later cannot silently pull the built output, the
      // dependency tree, or the tests themselves into the report. Coverage of
      // `dist/` would double-count everything in `src/`, and coverage of
      // `test/` measures how thoroughly the tests test themselves.
      exclude: ['dist/**', 'node_modules/**', 'test/**'],
      // Without this, the exclusions above are applied only BEFORE coverage is
      // remapped through source maps, so anything the remap reintroduces slips
      // back in. That is not hypothetical here: `dist/rolldown-runtime-*.js`,
      // `@vercel/stega` out of `node_modules`, and `test/integration/*.ts`
      // were all landing in `coverage-final.json` while matching `exclude`.
      // Note the text reporter groups rows by basename, so these are invisible
      // there and only show up in the JSON.
      excludeAfterRemap: true,
      reportOnFailure: true,
      clean: true,
    },
  },
})
