import {describe, expect, test} from 'vitest'

import pkg from '../package.json'

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
      `src/index.ts shouldn't have a default export`
    ).resolves.not.toHaveProperty('default')
    await expect(
      import('../src/index.browser'),
      `src/index.browser.ts shouldn't have a default export`
    ).resolves.not.toHaveProperty('default')
  })
})
