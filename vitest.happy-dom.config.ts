// Simulated browser environment (happy-dom). See vitest.browser.config.ts for
// the real thing.
import {defineConfig} from 'vitest/config'

import {nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: nonNodeExclude,
    environment: 'happy-dom',
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
  },
  resolve: {conditions: ['browser', 'module', 'import']},
})
