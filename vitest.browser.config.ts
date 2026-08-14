// Real browsers: chromium, firefox and webkit via Playwright.
import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'

import {coverageConfig, nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
    // Shared so that a `--coverage` run here reports the same shape as every
    // other suite rather than vitest's unfiltered defaults. Note that CI does
    // NOT collect browser coverage: `@vitest/coverage-v8` refuses to run
    // against more than one `browser.instances` entry, and this config runs
    // three (chromium, firefox, webkit). Collecting it would mean a
    // chromium-only run, which would largely duplicate the `coverage` job.
    coverage: coverageConfig,
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
