// Real browsers: chromium, firefox and webkit via Playwright.
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
    // Real browsers are the only environment `*.browser.test.ts` files
    // collect in (see `browserOnlyExclude` in vitest.config.ts) - they need
    // the upload server's URL, provided via globalSetup.upload.ts.
    globalSetup: ['./test/helpers/globalSetup.upload.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {browser: 'chromium', headless: true},
        {browser: 'firefox', headless: true},
        {browser: 'webkit', headless: true},
      ],
    },
  },
  resolve: {conditions: ['browser', 'module', 'import']},
})
