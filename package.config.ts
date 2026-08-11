import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',

  // `dist` is cleaned by default; list it alongside `coverage` to keep both.
  clean: ['dist', 'coverage'],

  deps: {alwaysBundle: ['@vercel/stega']},

  // pkg-utils v12 only emits `import` under the `node` condition. `require(esm)` activates
  // `require`, so without this the CJS side of Node backtracks out of the `node` branch and
  // gets the platform-neutral fetch build, silently skipping the Node middleware.
  // Guarded by test/exports.test.ts.
  exports: (prev) =>
    Object.fromEntries(
      Object.entries(prev).map(([path, entry]) => [
        path,
        entry.node?.import && !entry.node.require
          ? {...entry, node: {...entry.node, require: entry.node.import}}
          : entry,
      ]),
    ),

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
