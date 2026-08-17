// React Server Components condition. `package.json` declares a `react-server`
// export and nothing tested it before.
import {defineConfig} from 'vitest/config'

import {browserOnlyExclude, nonNodeExclude, sharedConfig, sourceAlias} from './vitest.config'

export default defineConfig({
  test: {
    ...sharedConfig,
    exclude: [...nonNodeExclude, ...browserOnlyExclude],
    alias: sourceAlias('default'),
    typecheck: {enabled: false},
  },
  resolve: {conditions: ['react-server', 'node']},
})
