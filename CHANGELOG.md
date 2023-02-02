<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [5.1.0](https://github.com/sanity-io/client/compare/v5.0.0...v5.1.0) (2023-02-02)

### Features

- add support for AbortController ([#92](https://github.com/sanity-io/client/issues/92)) ([775b5b5](https://github.com/sanity-io/client/commit/775b5b5d9cbb3ea1a5f094868113623bf0a7f793))

### Bug Fixes

- make `@types/node` a dev dependency ([88a4cc1](https://github.com/sanity-io/client/commit/88a4cc11eef60f4a3364dc31aaa7916b12308c9f))
- show a migration error when using the default export ([#105](https://github.com/sanity-io/client/issues/105)) ([adb582e](https://github.com/sanity-io/client/commit/adb582e0626d6cae44270fdc07a6157b1c36f2d1))

## [5.0.0](https://github.com/sanity-io/client/compare/v4.0.1...v5.0.0) (2023-02-02)

### ⚠ BREAKING CHANGES

- We have removed the default export and replaced it with a named one:

      ```diff
      -import SanityClient from '@sanity/client'
      +import {createClient} from '@sanity/client'
      ```

[The migration guide outlines every breaking change and how to migrate your code](https://github.com/sanity-io/client#from-v4)

### Features

- full Node.js ESM runtime support ([#86](https://github.com/sanity-io/client/issues/86)) ([bd9b247](https://github.com/sanity-io/client/commit/bd9b247f99ac513023581bfb1089b1892390d948)), closes [/github.com/sanity-io/client#from-v4](https://github.com/sanity-io//github.com/sanity-io/client/issues/from-v4)

## [4.0.1](https://github.com/sanity-io/client/compare/v4.0.0...v4.0.1) (2023-01-06)

### Bug Fixes

- **deps:** upgrade rxjs to v7 ([#80](https://github.com/sanity-io/client/issues/80)) ([594b4e7](https://github.com/sanity-io/client/commit/594b4e76253345bbaa678093b91faa101e240aee))
- use `NodeJS.ReadableStream` type for upload body type to prevent conflict with DOM `ReadableStream` ([#33](https://github.com/sanity-io/client/issues/33)) ([8cbfe0c](https://github.com/sanity-io/client/commit/8cbfe0cdf419c28b3fa1c0e897e08b94d54a2658))

## [4.0.0](https://github.com/sanity-io/client/compare/v3.4.1...v4.0.0) (2023-01-02)

### ⚠ BREAKING CHANGES

- Expanding ESM support is a significant change. Although a tremendous effort is made to preserve backward compatibility it can't be guaranteed as there are too many conditions, environments, and runtime versions to cover them all.

### Bug Fixes

- **deps:** update dependencies (non-major) ([#36](https://github.com/sanity-io/client/issues/36)) ([658b40f](https://github.com/sanity-io/client/commit/658b40fb51541eeb0b4313bd9aaef746eeb670d2))
- improve ESM output to support Deno, Bun and Edge runtimes ([#29](https://github.com/sanity-io/client/issues/29)) ([5ef19d4](https://github.com/sanity-io/client/commit/5ef19d497f884fce0b0f5e3974158df0ad6d9866))

## [3.4.1]

- fix(typings): `fetch()` does not need to return record

## [3.4.0]

- feat: allow setting `allowReconfigure` to `false` to prevent reconfiguration of existing client instance

## [3.3.7]

- fix(typings): make typings compatible with TypeScript 4.8
- fix(typings): add missing `params` to `MutationSelection`

## [3.3.6]

- fix(typings): missing class extend for `ObservableTransaction`

## [3.3.5]

- fix: regression introduced in #24. Partially exporting ESM breaks environments that bundle for the browser, such as Next.js. Remove `pkg.exports` until what we ship there is 100% compatible with the ecosystem.

## [3.3.4]

- fix: removed `@sanity/generate-help-url` dependency which threw `TypeError: generateHelpUrl is not a function` errors in some cases

## [3.3.3]

- fix(typings): observable client emits observables on transaction/patch commit

## [3.3.2]

- fix(typings): add missing `operation` property on mutation result

## [3.3.1]

- docs: fix typo in readme (#10)
- chore: upgrade eventsource dependency

## [3.3.0]

- feat: add `dryRun`, `autoGenerateArrayKeys` mutation options

## [3.2.2]

- fix: use named import for `@sanity/generate-help-url` module

## [3.2.1]

- chore(deps): upgrade dependencies

## [3.2.0]

- fix(typings): add missing `timeout` config option
- feat: support passing custom headers to http methods (#5)

## [3.1.0]

- feat: add new polyfill for event source (#2)

## [3.0.6]

- feat: make `request()` return value generic
- feat: add `skipCrossDatasetReferenceValidation` flag to mutations

## [3.0.4]

- fix(typings): add missing `clone()` method on requester

## [3.0.3]

- feat(http): request compressed responses

## [3.0.2]

- fix(typings): add missing `maxRedirects` option

## [3.0.1]

- fix(typings): use rxjs for observable type

## [3.0.0]

- BREAKING: Passing a `token` _and_ `useCdn: true` will now use the API CDN for queries, where it previously used the uncached, "live" API
- BREAKING: Client now only supports Node.js v12 and higher
- BREAKING: Remove deprecated `merge` patch operator
- BREAKING: Remove deprecated `document` property on `assets.upload` response
- BREAKING: Make sure `client.observable.fetch()` returns a cold observable

[3.4.1]: https://github.com/sanity-io/client/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/sanity-io/client/compare/v3.3.7...v3.4.0
[3.3.7]: https://github.com/sanity-io/client/compare/v3.3.6...v3.3.7
[3.3.6]: https://github.com/sanity-io/client/compare/v3.3.5...v3.3.6
[3.3.5]: https://github.com/sanity-io/client/compare/v3.3.4...v3.3.5
[3.3.4]: https://github.com/sanity-io/client/compare/v3.3.3...v3.3.4
[3.3.3]: https://github.com/sanity-io/client/compare/v3.3.2...v3.3.3
[3.3.2]: https://github.com/sanity-io/client/compare/v3.3.1...v3.3.2
[3.3.1]: https://github.com/sanity-io/client/compare/v3.3.0...v3.3.1
[3.3.0]: https://github.com/sanity-io/client/compare/v3.2.2...v3.3.0
[3.2.2]: https://github.com/sanity-io/client/compare/v3.2.1...v3.2.2
[3.2.1]: https://github.com/sanity-io/client/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/sanity-io/client/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/sanity-io/client/compare/v3.0.6...v3.1.0
[3.0.6]: https://github.com/sanity-io/client/compare/v3.0.4...v3.0.6
[3.0.4]: https://github.com/sanity-io/client/compare/v3.0.3...v3.0.4
[3.0.3]: https://github.com/sanity-io/client/compare/v3.0.2...v3.0.3
[3.0.2]: https://github.com/sanity-io/client/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/sanity-io/client/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/sanity-io/client/compare/v2.23.2...v3.0.0
