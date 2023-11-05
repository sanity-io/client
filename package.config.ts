import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',

  extract: {
    rules: {
      'ae-forgotten-export': 'error',
      'ae-missing-release-tag': 'error',
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
    },
  },
})
