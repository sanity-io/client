import {defineConfig} from 'vitest/config'

import {browserOnlyExclude, nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...nonNodeExclude, ...browserOnlyExclude],
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
  },
})
