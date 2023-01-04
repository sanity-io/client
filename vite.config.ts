// This is the default config, runs with Node.js globals and doesn't require `npm run build` before executing tests

import {configDefaults, defineConfig, type UserConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

import pkg from './package.json'

export const sharedConfig: UserConfig['test'] = {
  // interopDefault is required for the CJS-only packages we still rely on, like @sanity/eventsource
  deps: {interopDefault: true},
  // don't use vitest to run Bun and Deno tests
  exclude: [...configDefaults.exclude, 'runtimes/**'],
  // Enable rich PR failed test annotation on the CI
  reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
  // Allow switching test runs from using the source TS or compiled ESM
  alias: {'@sanity/client': pkg.exports['.'].source},
}

export default defineConfig({
  test: sharedConfig,
})
