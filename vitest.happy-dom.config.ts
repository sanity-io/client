import {defineConfig} from 'vitest/config'

import {browserOnlyExclude, nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    // happy-dom's `XMLHttpRequest` doesn't fire `upload.onprogress` or
    // `ontimeout` (see the comment on `browserOnlyExclude`), so it can't
    // exercise `*.browser.test.ts` files despite having the global.
    exclude: [...nonNodeExclude, ...browserOnlyExclude],
    environment: 'happy-dom',
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
  },
  resolve: {conditions: ['browser', 'module', 'import']},
})
