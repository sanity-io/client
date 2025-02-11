// Simulates a browser environment until `@vitest/browser` is ready for production and
// we can run the tests in a real browser

import {defineConfig, mergeConfig} from 'vitest/config'

import pkg from './package.json'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      alias: {
        '@sanity/client/csm': new URL(pkg.exports['./csm'].source, import.meta.url).pathname,
        '@sanity/client/stega': new URL(pkg.exports['./stega'].browser.source, import.meta.url)
          .pathname,
        '@sanity/client': new URL(pkg.exports['.'].browser.source, import.meta.url).pathname,
      },
      typecheck: {
        enabled: false,
      },
    },
    resolve: {
      conditions: ['browser', 'module', 'import'],
    },
  }),
)
