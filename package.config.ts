import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',

  // `dist` is cleaned by default; list it alongside `coverage` to keep both.
  clean: ['dist', 'coverage'],

  deps: {alwaysBundle: ['@vercel/stega']},

  tsdoc: {
    rules: {
      'ae-incompatible-release-tags': 'off',
      'ae-internal-missing-underscore': 'off',
      // Downgraded from 'error': the v12 dts pipeline emits the `studioPath` namespace
      // re-export in `csm` as a synthesized `studioPath_d_exports` declaration and drops the
      // `@alpha` tag from the source, which cannot be tagged from userland.
      'ae-missing-release-tag': 'warn',
    },
  },
})
