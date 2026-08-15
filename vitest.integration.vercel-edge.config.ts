import {defineConfig} from 'vitest/config'

import {integrationProvide} from './vitest.integration.config'

// Same condition set as `vitest.vercel-edge.config.ts`:
// https://github.com/vercel/next.js/blob/95322649ffb2ad0d6423481faed188dd7b1f7ff2/packages/next/src/build/webpack-config.ts#L1079-L1084
const conditions = ['edge-light', 'worker', 'browser', 'module', 'import', 'node']

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    provide: integrationProvide,
    testTimeout: 60_000,
    slowTestThreshold: 20_000,
    environment: 'edge-runtime',
  },
  resolve: {conditions},
  // Vite's module runner injects `node` otherwise, resolving the undici build
  // rather than the fetch build a real Vercel Edge deployment gets.
  ssr: {resolve: {conditions}},
})
