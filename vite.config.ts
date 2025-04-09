// This is the default config, runs with Node.js globals and doesn't require `npm run build` before executing tests

import {configDefaults, defineConfig} from 'vitest/config'

import pkg from './package.json'

export default defineConfig({
  test: {
    // don't use vitest to run Bun and Deno tests
    exclude: [...configDefaults.exclude, 'runtimes/**', 'test-next/**'],
    // Allow switching test runs from using the source TS or compiled ESM
    alias: {
      '@sanity/client/csm': new URL(pkg.exports['./csm'].source, import.meta.url).pathname,
      '@sanity/client/stega': new URL(pkg.exports['./stega'].source, import.meta.url).pathname,
      '@sanity/client': new URL(pkg.exports['.'].source, import.meta.url).pathname,
    },
    typecheck: {
      enabled: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      include: ['src/**'],
      reportOnFailure: true,
      clean: true,
    },
  },
})
