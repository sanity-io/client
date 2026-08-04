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
      environmentOptions: {
        happyDOM: {
          // happy-dom v20 enforces the CORS same-origin policy and issues preflight
          // `OPTIONS` requests for cross-origin fetches. The test suite mocks the API
          // with nock (which only intercepts the real requests, not the preflights),
          // so disable the same-origin policy to keep the simulated browser behavior
          // aligned with what these tests expect.
          settings: {
            fetch: {
              disableSameOriginPolicy: true,
            },
          },
        },
      },
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
