<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [6.1.2](https://github.com/sanity-io/client/compare/v6.1.1...v6.1.2) (2023-05-23)

### Bug Fixes

- update `RawQueryResponse` response type properties ([#232](https://github.com/sanity-io/client/issues/232)) ([5eb0272](https://github.com/sanity-io/client/commit/5eb027255207d55c648d257329980bc2533c268c))

## [6.1.1](https://github.com/sanity-io/client/compare/v6.1.0...v6.1.1) (2023-05-16)

### Bug Fixes

- prevent crash when using `url` option instead of `uri` ([#231](https://github.com/sanity-io/client/issues/231)) ([573c1bd](https://github.com/sanity-io/client/commit/573c1bddb67ae6b94d8ba0e3ad154b530d54274a))

## [6.1.0](https://github.com/sanity-io/client/compare/v6.0.1...v6.1.0) (2023-05-15)

### Features

- add `perspective` parameter ([#224](https://github.com/sanity-io/client/issues/224)) ([61f36de](https://github.com/sanity-io/client/commit/61f36deb5b9d76e1ec7621d70ce9be0a8d05c3ae))

### Bug Fixes

- apply `resultSourceMap` parameter only to queries ([#225](https://github.com/sanity-io/client/issues/225)) ([dac8ea6](https://github.com/sanity-io/client/commit/dac8ea64f506b41d4dbfb4364e598739438efe6d))

## [6.0.1](https://github.com/sanity-io/client/compare/v6.0.0...v6.0.1) (2023-05-03)

### Bug Fixes

- add release notes ([53533f5](https://github.com/sanity-io/client/commit/53533f5f4d32af6a5f669667fefb3cf80176a9f2))

## [6.0.0](https://github.com/sanity-io/client/compare/v5.4.2...v6.0.0) (2023-05-03)

### ⚠ BREAKING CHANGES

- `useCdn` is now set to `true` by default. Our CDN ensures your content has reliably, world-wide delivery by caching queries made from your front-end. If you require fresh data for every query, perhaps for testing purposes, add `useCdn: false` to your configuration.
- Client will now automatically retry all GET/HEAD requests as well as queries if the server responds with a 429, 502 or 503 status code - as well as on socket/DNS errors. Previously, the client would immediately throw an error. If you have application-level retry code, you should either disable the retrying in the client by passing `{maxRetries: 0}`, or remove the custom retry code and potentially alter the `retryDelay` and `maxRetries` options to match your wanted behavior.

[The migration guide outlines every breaking change and how to migrate your code](https://github.com/sanity-io/client#from-v5)

### Introducing Content Source Maps

> **Note**
>
> Content Source Maps are available for select [Sanity enterprise customers](https://www.sanity.io/enterprise?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch). [Contact our sales team for more information.](https://www.sanity.io/contact/sales?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch)

![](https://i.imgur.com/wt95U5Q.jpg)

Content Source Maps are an optional layer of contextual metadata sent with queries to enable use cases such as [Visual Editing](https://www.sanity.io/blog/visual-editing-sanity-vercel?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch), tracing content lineage, and more. Our implementation of Content Source Maps are based on an [open standard posted on GitHub](https://github.com/sanity-io/content-source-maps), and you can read [the API documentation here](https://www.sanity.io/docs/content-source-maps?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch). To get started with Content Source Maps, check out the documentation in the README file.

### Features

- add automatic retrying of 429, 502, 503 (#199)

### Bug Fixes

- make useCdn use true by default (#191)
- undeprecate request() (#205)

## [5.4.2](https://github.com/sanity-io/client/compare/v5.4.1...v5.4.2) (2023-04-03)

### Bug Fixes

- **mutate:** reflect support for providing transaction id in typings ([#187](https://github.com/sanity-io/client/issues/187)) ([b7ad302](https://github.com/sanity-io/client/commit/b7ad302d80ce90574e3d52875f3af67c65e683eb))
- **mutate:** serialize clientless patches correctly ([#186](https://github.com/sanity-io/client/issues/186)) ([b635dff](https://github.com/sanity-io/client/commit/b635dffc9073d6452735a6128c344b924b58d599))

## [5.4.1](https://github.com/sanity-io/client/compare/v5.4.0...v5.4.1) (2023-03-30)

### Bug Fixes

- **listen:** lazy init event source ([#181](https://github.com/sanity-io/client/issues/181)) ([a84ee1c](https://github.com/sanity-io/client/commit/a84ee1ceb3e8cf49ea5b60d227240803efbd2548))

## [5.4.0](https://github.com/sanity-io/client/compare/v5.3.2...v5.4.0) (2023-03-28)

### Features

- add `edge-light` export condition ([#176](https://github.com/sanity-io/client/issues/176)) ([501e7b6](https://github.com/sanity-io/client/commit/501e7b646d5d93f46849529b4d2d9cecd3b8a4a2))

## [5.3.2](https://github.com/sanity-io/client/compare/v5.3.1...v5.3.2) (2023-03-23)

### Bug Fixes

- declare `File` for envs without `lib.dom` ([#175](https://github.com/sanity-io/client/issues/175)) ([1e9cb5e](https://github.com/sanity-io/client/commit/1e9cb5ea4bde338f35f30e59722d56e32eccc3a1))

## [5.3.1](https://github.com/sanity-io/client/compare/v5.3.0...v5.3.1) (2023-03-22)

### Bug Fixes

- **deps:** update dependency @sanity/eventsource to v5 ([#169](https://github.com/sanity-io/client/issues/169)) ([1cda138](https://github.com/sanity-io/client/commit/1cda13862852b4aaddebeec34079d0df752e4603))

## [5.3.0](https://github.com/sanity-io/client/compare/v5.2.2...v5.3.0) (2023-03-13)

### Features

- include mutation error items in error message ([#148](https://github.com/sanity-io/client/issues/148)) ([193f45e](https://github.com/sanity-io/client/commit/193f45e6ab3efa0a53aafd86acca6f04149d4172))

### Bug Fixes

- correct document ID validation ([#149](https://github.com/sanity-io/client/issues/149)) ([b5799c9](https://github.com/sanity-io/client/commit/b5799c9a7dcc588bb6fb51941a297a0bb8200751))
- **deps:** update devdependencies (non-major) ([#137](https://github.com/sanity-io/client/issues/137)) ([13c9fe4](https://github.com/sanity-io/client/commit/13c9fe4f2860ab07be247fea54dff0352eec30de))

## [5.2.2](https://github.com/sanity-io/client/compare/v5.2.1...v5.2.2) (2023-02-21)

### Bug Fixes

- **deps:** update devdependencies (non-major) ([#132](https://github.com/sanity-io/client/issues/132)) ([0acb16b](https://github.com/sanity-io/client/commit/0acb16b385e80a67908216b7ccd07250adfa96d4))

## [5.2.1](https://github.com/sanity-io/client/compare/v5.2.0...v5.2.1) (2023-02-15)

### Bug Fixes

- add support for using the default export ([#117](https://github.com/sanity-io/client/issues/117)) ([1b1fb16](https://github.com/sanity-io/client/commit/1b1fb16371ad323f7bd05d2086acea8a5bdd8237))
- use `Any` for explicit any ([#115](https://github.com/sanity-io/client/issues/115)) ([d588cf6](https://github.com/sanity-io/client/commit/d588cf6cfb90145b988dee6a9b5d7512a64e0a30))

## [5.2.0](https://github.com/sanity-io/client/compare/v5.1.0...v5.2.0) (2023-02-07)

### Features

- add back `getUrl` & `getDataUrl` ([#110](https://github.com/sanity-io/client/issues/110)) ([6cfee72](https://github.com/sanity-io/client/commit/6cfee72c10f5d4b4b811ea431f5cc16dd7eaa690))

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

- full Node.js ESM runtime support ([#86](https://github.com/sanity-io/client/issues/86)) ([bd9b247](https://github.com/sanity-io/client/commit/bd9b247f99ac513023581bfb1089b1892390d948))

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
