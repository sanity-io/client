<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# Change Log

All notable changes to this project will be documented in this file.

## Unreleased
- fix(typings): missing class extend in #22

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
