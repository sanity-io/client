// This suite is a set of minimal, per-feature integration smoke tests (see
// CONTRIBUTING.md, "Integration smoke tests"), run against the BUILT package
// through the real `exports` map - so it verifies both that the runtime's
// resolved entry loads and that the API still speaks our protocol.
import {defineConfig} from 'vitest/config'

/**
 * The environment the integration suite reads its configuration from.
 *
 * Every value is a string, and an empty string means "not set" - see
 * {@link integrationProvide} for why they are not read from `process.env` in
 * the tests themselves.
 */
export interface IntegrationEnv {
  SANITY_INTEGRATION_TOKEN: string
  SANITY_INTEGRATION_ORG_TOKEN: string
  SANITY_INTEGRATION_PROJECT_ID: string
  SANITY_INTEGRATION_DATASET: string
  SANITY_INTEGRATION_MEDIA_LIBRARY_ID: string
  SANITY_INTEGRATION_VIDEO_ASSET_ID: string
}

declare module 'vitest' {
  interface ProvidedContext {
    integrationEnv: IntegrationEnv
  }
}

/**
 * Suite configuration read here, in the config, and handed to the tests over
 * vitest's `provide`/`inject` channel rather than read from `process.env` by
 * the tests themselves, because of workerd - `@cloudflare/vitest-pool-workers`
 * has a permanently empty `process.env` inside the worker.
 *
 * Config files run in Node, where `process.env` works.
 */
export const integrationProvide = {
  integrationEnv: {
    SANITY_INTEGRATION_TOKEN: process.env.SANITY_INTEGRATION_TOKEN ?? '',
    SANITY_INTEGRATION_ORG_TOKEN: process.env.SANITY_INTEGRATION_ORG_TOKEN ?? '',
    SANITY_INTEGRATION_PROJECT_ID: process.env.SANITY_INTEGRATION_PROJECT_ID ?? '',
    SANITY_INTEGRATION_DATASET: process.env.SANITY_INTEGRATION_DATASET ?? '',
    SANITY_INTEGRATION_MEDIA_LIBRARY_ID: process.env.SANITY_INTEGRATION_MEDIA_LIBRARY_ID ?? '',
    SANITY_INTEGRATION_VIDEO_ASSET_ID: process.env.SANITY_INTEGRATION_VIDEO_ASSET_ID ?? '',
  },
} satisfies {integrationEnv: IntegrationEnv}

export default defineConfig({
  test: {
    provide: integrationProvide,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      exclude: ['node_modules/**', 'test/**', 'dist/rolldown-runtime-*.js'],
      excludeAfterRemap: false,
      reportOnFailure: true,
      clean: true,
    },
    include: ['test/**/*.integration.test.ts'],
    reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : 'default',

    // Integration tests needs a higher timeout because they run real requests.
    // Some of them are pretty slow, although it varies. Setting this too low
    // will just cause flake.
    testTimeout: 60_000,

    // Minor, but we know integration tests are slow, so don't mark them red.
    slowTestThreshold: 20_000,
  },
})
