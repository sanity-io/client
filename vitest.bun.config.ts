import assert from 'node:assert/strict'

import {defineConfig, mergeConfig} from 'vitest/config'

import nodeConfig from './vitest.config'

// `bun run vitest` follows Vitest's Node shebang unless --bun is supplied.
assert.ok(process.versions.bun, 'Run the Bun suite with pnpm test:bun')

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      // Bun supplies Node streams, but its undici ProxyAgent is a no-op.
      // Keep the other *.node.test.ts files, including file-stream uploads.
      exclude: ['test/proxy.node.test.ts'],
    },
  }),
)
