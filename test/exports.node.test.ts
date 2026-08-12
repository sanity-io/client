import {describe, expect, test} from 'vitest'

import pkg from '../package.json'

// `src/index.node.ts` statically imports `get-it/node` (undici), which
// touches `process` at module load time - real browsers can't import it at
// all, so the parity check against it lives here rather than in
// `exports.test.ts`.
describe('pkg.exports["."]', () => {
  test('check that `source` fields are in sync with test expectations', () => {
    // if these entries change then ensure test suites have updated assumptions
    expect(pkg.exports['.'].source).toBe('./src/index.ts')
    expect(pkg.exports['.'].node.source).toBe('./src/index.node.ts')
  })
  test('ensure the default and `node` entries have the same exports', async () => {
    // It can be easy to forget changing index.node.ts while changing index.ts
    const source = await import('../src/index')
    const node = await import('../src/index.node')
    expect(Object.keys(source)).toEqual(Object.keys(node))
  })
  // oxlint-disable-next-line no-warning-comments
  // @TODO disabling this test until we no longer have the migrationNotice.ts
  test.skip('default exports should not be used', async () => {
    await expect(
      import('../src/index'),
      `src/index.ts shouldn't have a default export`,
    ).resolves.not.toHaveProperty('default')
    await expect(
      import('../src/index.node'),
      `src/index.node.ts shouldn't have a default export`,
    ).resolves.not.toHaveProperty('default')
  })
})
