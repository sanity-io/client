import {describe, expect, test} from 'vitest'

import pkg from '../package.json'

/**
 * The browser/fetch build that worker/edge runtimes must resolve. The Node
 * build (`./dist/index.js`) pulls in `get-it/node` (undici), which is not
 * available on worker runtimes.
 */
const FETCH_BUILD = './dist/index.browser.js'
const NODE_BUILD = './dist/index.js'

type ExportEntry = string | {[condition: string]: ExportEntry}

/**
 * Minimal model of Node's conditional exports resolution: walk the export
 * object in *key order* and return the first branch whose condition is active
 * (or the catch-all `default`). Crucially it does NOT implicitly inject `node`
 * - the caller decides which conditions are active - so a worker condition set
 * that happens to also include `node` (e.g. wrangler + nodejs_compat) is
 * modelled faithfully.
 */
function resolveExport(entry: ExportEntry, conditions: Set<string>): string | undefined {
  if (typeof entry === 'string') return entry
  for (const [condition, value] of Object.entries(entry)) {
    if (condition === 'default' || conditions.has(condition)) {
      const resolved = resolveExport(value, conditions)
      if (resolved !== undefined) return resolved
    }
  }
  return undefined
}

describe('pkg.exports - worker/edge resolution guard', () => {
  // Condition sets each runtime activates, in the form Node resolution sees
  // them (membership, not order). `workerd (bare)` is the headline case: the
  // client must resolve the fetch build on a stock worker WITHOUT
  // `nodejs_compat`. `workerd (wrangler + nodejs_compat)` is the adversarial
  // case - with `nodejs_compat` the `node` condition becomes active, which is
  // exactly what breaks a node-first map; it must still pick the fetch build.
  const workerRuntimes = {
    'workerd (bare)': ['workerd', 'worker', 'browser', 'module', 'import'],
    'workerd (wrangler + nodejs_compat)': [
      'workerd',
      'worker',
      'browser',
      'module',
      'import',
      'node',
    ],
    'vercel edge': ['edge-light', 'worker', 'browser', 'module', 'import', 'node'],
    deno: ['deno', 'node', 'module', 'import'],
    bun: ['bun', 'node', 'module', 'import'],
  } as const

  for (const [runtime, conditions] of Object.entries(workerRuntimes)) {
    test(`${runtime} never resolves the Node (undici) build for "."`, () => {
      const resolved = resolveExport(pkg.exports['.'], new Set(conditions))
      expect(resolved).not.toBe(NODE_BUILD)
      expect(resolved).toBe(FETCH_BUILD)
    })
  }

  test('the resolver is non-vacuous: a node-first map DOES hand workers the undici build', () => {
    // A hand-authored node-first shape - the bug this guard exists to catch.
    // If our resolver could not detect it, the assertions above would be
    // meaningless.
    const nodeFirst: ExportEntry = {
      source: './src/index.ts',
      node: NODE_BUILD,
      browser: {import: FETCH_BUILD},
      import: NODE_BUILD,
      default: NODE_BUILD,
    }
    const workerd = new Set(workerRuntimes['workerd (wrangler + nodejs_compat)'])
    expect(resolveExport(nodeFirst, workerd)).toBe(NODE_BUILD)
  })
})

describe('pkg.exports["."]', () => {
  test('check that `source` fields are in sync with test expectations', () => {
    // if these entries change then ensure test suites have updated assumptions
    expect(pkg.exports['.'].source).toBe('./src/index.ts')
    expect(pkg.exports['.'].browser.source).toBe('./src/index.browser.ts')
  })
  test('ensure the `source` and `browser.source` entries have the same exports', async () => {
    // It can be easy to forget changing index.browser.ts while changing index.ts
    const source = await import('../src/index')
    const browser = await import('../src/index.browser')
    expect(Object.keys(source)).toEqual(Object.keys(browser))
  })
  // eslint-disable-next-line no-warning-comments
  // @TODO disabling this test until we no longer have the migrationNotice.ts
  test.skip('default exports should not be used', async () => {
    await expect(
      import('../src/index'),
      `src/index.ts shouldn't have a default export`,
    ).resolves.not.toHaveProperty('default')
    await expect(
      import('../src/index.browser'),
      `src/index.browser.ts shouldn't have a default export`,
    ).resolves.not.toHaveProperty('default')
  })
})
