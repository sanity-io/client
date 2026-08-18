import {cloudflareTest} from '@cloudflare/vitest-pool-workers'
import {defineConfig} from 'vitest/config'

import {integrationProvide} from './vitest.integration.config'

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // `2026-03-03` is used here because the fetch implementation leaves unhandled
        // rejections for a microtask and causes vitest to fail without it.
        compatibilityDate: '2026-03-03',
        compatibilityFlags: [],
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',
    provide: integrationProvide,
    testTimeout: 60_000,
    slowTestThreshold: 20_000,
  },
})
