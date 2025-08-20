<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [7.9.0](https://github.com/sanity-io/client/compare/v7.8.2...v7.9.0) (2025-08-20)


### Features

* add ReleaseCardinality type and update ReleaseDocument interface ([#1129](https://github.com/sanity-io/client/issues/1129)) ([fd5198e](https://github.com/sanity-io/client/commit/fd5198efe3d3c685375a8bcb133568d7fd8055f8))
* allow experimental resource for projects and datasets ([#1124](https://github.com/sanity-io/client/issues/1124)) ([a2c8892](https://github.com/sanity-io/client/commit/a2c889218b2b0895b4257c50b47eaf95bda5876e))

## [7.8.2](https://github.com/sanity-io/client/compare/v7.8.1...v7.8.2) (2025-08-04)


### Bug Fixes

* allows perspective on instructionParams ([#1122](https://github.com/sanity-io/client/issues/1122)) ([32a9463](https://github.com/sanity-io/client/commit/32a9463b6cd67e2f0a3f0deb2f4001ed29812466))
* correctly uses format: 'string' typing for prompt ([#1121](https://github.com/sanity-io/client/issues/1121)) ([f3e07ea](https://github.com/sanity-io/client/commit/f3e07ea64c825cacdec83999b11914909ebe41a2))
* **stega:** narrow filtering URL patterns to valid URL protocols ([#1118](https://github.com/sanity-io/client/issues/1118)) ([b8788f5](https://github.com/sanity-io/client/commit/b8788f5cf47e674c56673f9cbf400d94d351b76a))

## [7.8.1](https://github.com/sanity-io/client/compare/v7.8.0...v7.8.1) (2025-07-22)


### Bug Fixes

* add missing `provider` property to `CurrentSanityUser` type ([#1115](https://github.com/sanity-io/client/issues/1115)) ([5d98eca](https://github.com/sanity-io/client/commit/5d98eca1883b41380f2995dcbb1c6b9196724663))

## [7.8.0](https://github.com/sanity-io/client/compare/v7.7.0...v7.8.0) (2025-07-16)


### Features

* version.create action supports optional `baseId` and `versionId` instead of `document` ([#1108](https://github.com/sanity-io/client/issues/1108)) ([aaa1042](https://github.com/sanity-io/client/commit/aaa1042f0e47b358088d15bf6b06ab1d80ecf289))

## [7.7.0](https://github.com/sanity-io/client/compare/v7.6.0...v7.7.0) (2025-07-15)


### Features

* add `isHttpError` method (and shared `HttpError` interface) ([#1112](https://github.com/sanity-io/client/issues/1112)) ([98ee6d3](https://github.com/sanity-io/client/commit/98ee6d39a28ea3480e198a222b138c669f2cb16d))
* add ignoreExperimentalApiWarning configuration option ([#1107](https://github.com/sanity-io/client/issues/1107)) ([b1cdfbe](https://github.com/sanity-io/client/commit/b1cdfbec3774e3fe6d76f4a658f0a43b4b7e2eb6))

## [7.6.0](https://github.com/sanity-io/client/compare/v7.5.0...v7.6.0) (2025-06-13)


### Features

* **transform:** adds support for optional imageUrl param in for target.operation image-description ([#1105](https://github.com/sanity-io/client/issues/1105)) ([c47214f](https://github.com/sanity-io/client/commit/c47214fc502d8605914228d9a89d6d482eb26ec1))

## [7.5.0](https://github.com/sanity-io/client/compare/v7.4.1...v7.5.0) (2025-06-06)


### Features

* `agent.action.transform` can now transform images to text descriptions ([#1096](https://github.com/sanity-io/client/issues/1096)) ([609e572](https://github.com/sanity-io/client/commit/609e572702090607cdca49df4ad313a8585a76be))

## [7.4.1](https://github.com/sanity-io/client/compare/v7.4.0...v7.4.1) (2025-06-04)


### Bug Fixes

* only allow non-nullable values in search params ([#1043](https://github.com/sanity-io/client/issues/1043)) ([19c00ea](https://github.com/sanity-io/client/commit/19c00ea7166ca36eb29c38c5e97ccebf6b8b19a4))

## [7.4.0](https://github.com/sanity-io/client/compare/v7.3.0...v7.4.0) (2025-05-29)


### Features

* agent.action.patch - a schema aware patch api ([#1091](https://github.com/sanity-io/client/issues/1091)) ([0bf6de3](https://github.com/sanity-io/client/commit/0bf6de3d582d81ccf114b7354b571a4db0a887a7))
* agent.action.prompt ([d6b08b7](https://github.com/sanity-io/client/commit/d6b08b760bd1a2b9ff39a9dd28a79857840e9540))
* agent.action.prompt – for when you dont want to bring an LLM key and just use Sanity ([#1078](https://github.com/sanity-io/client/issues/1078)) ([d6b08b7](https://github.com/sanity-io/client/commit/d6b08b760bd1a2b9ff39a9dd28a79857840e9540))
* new agent action parameter forcePublishedWrite – agent actions never write to published doc by default ([#1092](https://github.com/sanity-io/client/issues/1092)) ([7587e2c](https://github.com/sanity-io/client/commit/7587e2cadd98a503ac1d38139bd4b0c5a8d2327e))


### Bug Fixes

* add support for custom headers in listen and live clients ([#1087](https://github.com/sanity-io/client/issues/1087)) ([11a103f](https://github.com/sanity-io/client/commit/11a103fe6d1cea0618835e8fa0bc8492d0a83558))
* **docs:** adds examples on how to generate and transform images ([#1093](https://github.com/sanity-io/client/issues/1093)) ([475214d](https://github.com/sanity-io/client/commit/475214df57e734b03df5940573e120e1ef87eb22))
* improve query parse errors ([#1065](https://github.com/sanity-io/client/issues/1065)) ([a734fdb](https://github.com/sanity-io/client/commit/a734fdb98d1ca605fe7bc941d2c677f0ef7dec23))

## [7.3.0](https://github.com/sanity-io/client/compare/v7.2.2...v7.3.0) (2025-05-20)


### Features

* pass default headers to createClient for all requests ([#1079](https://github.com/sanity-io/client/issues/1079)) ([e99c852](https://github.com/sanity-io/client/commit/e99c8521fa7df5cceb7ea1ea3d9fdbe54e8efa85))

## [7.2.2](https://github.com/sanity-io/client/compare/v7.2.1...v7.2.2) (2025-05-19)


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.9 ([#1080](https://github.com/sanity-io/client/issues/1080)) ([7a7c6be](https://github.com/sanity-io/client/commit/7a7c6be9291afbb27bc6bae02242efbb8cc9f41f))

## [7.2.1](https://github.com/sanity-io/client/compare/v7.2.0...v7.2.1) (2025-05-09)


### Bug Fixes

* downgrade `nanoid` to ensure compatibility with node &lt; 22 ([#1076](https://github.com/sanity-io/client/issues/1076)) ([368a12d](https://github.com/sanity-io/client/commit/368a12d889b4b92e7d2e62dc9af36000b51cbd44))

## [7.2.0](https://github.com/sanity-io/client/compare/v7.1.0...v7.2.0) (2025-05-09)


### Features

* releases client and document version actions ([#1067](https://github.com/sanity-io/client/issues/1067)) ([9b80bd8](https://github.com/sanity-io/client/commit/9b80bd80595e2a289bc5af3304bba44c486a12ae))

## [7.1.0](https://github.com/sanity-io/client/compare/v7.0.0...v7.1.0) (2025-05-05)


### Features

* agent actions API integration (vX only) ([#1041](https://github.com/sanity-io/client/issues/1041)) ([d8df8aa](https://github.com/sanity-io/client/commit/d8df8aaf6d943e494ae04ebbfccf758ce19cf9c4))

## [7.0.0](https://github.com/sanity-io/client/compare/v6.29.1...v7.0.0) (2025-04-30)


### ⚠ BREAKING CHANGES

* Dropping support for Node.js < v20 as Node.js v18 is EOL as of 2025-04-30

### Bug Fixes

* drop support for node &lt; v20 ([#1060](https://github.com/sanity-io/client/issues/1060)) ([23e4082](https://github.com/sanity-io/client/commit/23e40823bba98a90ec90567d3f042234b6731fc2))

## [6.29.1](https://github.com/sanity-io/client/compare/v6.29.0...v6.29.1) (2025-04-25)


### Bug Fixes

* dependency update, import condition ([d8109b9](https://github.com/sanity-io/client/commit/d8109b9702b25df537d16d6dd21c3ef82c5fc29d))

## [6.29.0](https://github.com/sanity-io/client/compare/v6.28.4...v6.29.0) (2025-04-11)


### Features

* add experimental support for resources ([#1040](https://github.com/sanity-io/client/issues/1040)) ([9f15a36](https://github.com/sanity-io/client/commit/9f15a365e8161e1db4c64ffe6ba3ac67215bbfee))
* **live:** add goaway event ([#1055](https://github.com/sanity-io/client/issues/1055)) ([7c57d3d](https://github.com/sanity-io/client/commit/7c57d3da71e3cd783566f39f3089c42bc14e1d22))

## [6.28.4](https://github.com/sanity-io/client/compare/v6.28.3...v6.28.4) (2025-03-27)


### Bug Fixes

* do not set `withCredentials` if token is set ([#1037](https://github.com/sanity-io/client/issues/1037)) ([0d0730a](https://github.com/sanity-io/client/commit/0d0730a05cc1644a8dbde64c0b2129b9deede0aa))
* remove client side validation of api perspective ([#1036](https://github.com/sanity-io/client/issues/1036)) ([f10b170](https://github.com/sanity-io/client/commit/f10b1707346d0acf692833add8ead2f814c0ed59))

## [6.28.3](https://github.com/sanity-io/client/compare/v6.28.2...v6.28.3) (2025-03-04)


### Bug Fixes

* **docs:** invalid changelog url ([#1029](https://github.com/sanity-io/client/issues/1029)) ([0ddde6f](https://github.com/sanity-io/client/commit/0ddde6f2473450e96a897b48cafc38786a4889e7))
* invalid changelog url ([0ddde6f](https://github.com/sanity-io/client/commit/0ddde6f2473450e96a897b48cafc38786a4889e7))

## [6.28.2](https://github.com/sanity-io/client/compare/v6.28.1...v6.28.2) (2025-02-28)


### Bug Fixes

* **docs:** make dataset and project related types public ([#1026](https://github.com/sanity-io/client/issues/1026)) ([b0a622a](https://github.com/sanity-io/client/commit/b0a622a3f6614ec79e4c9bca22a0f25e5ed132fa))

## [6.28.1](https://github.com/sanity-io/client/compare/v6.28.0...v6.28.1) (2025-02-24)


### Bug Fixes

* trigger semantic release version bump ([#1024](https://github.com/sanity-io/client/issues/1024)) ([6ccc8bd](https://github.com/sanity-io/client/commit/6ccc8bd2d724a79e1286d42fe9d43e214fce2691))

## [6.28.0](https://github.com/sanity-io/client/compare/v6.27.2...v6.28.0) (2025-02-11)


### Features

* **listener:** add support for includeAllVersions ([#1003](https://github.com/sanity-io/client/issues/1003)) ([fff3a76](https://github.com/sanity-io/client/commit/fff3a76f8ca8e0cfba2c8a16e3c2b3b662fe80bb))


### Bug Fixes

* deprecate `previewDrafts`-perspective in favor of `drafts` ([#1007](https://github.com/sanity-io/client/issues/1007)) ([3b03ac5](https://github.com/sanity-io/client/commit/3b03ac5e50b5cda37e7a36e9b17950ba4e200147))
* lift restriction on release perspective name ([#1005](https://github.com/sanity-io/client/issues/1005)) ([cdfacc9](https://github.com/sanity-io/client/commit/cdfacc93d77ca9c98ac19c75672e23fc966ed08c))
* **live:** dedupe event source instances ([#990](https://github.com/sanity-io/client/issues/990)) ([a26714d](https://github.com/sanity-io/client/commit/a26714d9a7f86d2a41c37b250573b6dfef9bd7c3))

## [6.27.2](https://github.com/sanity-io/client/compare/v6.27.1...v6.27.2) (2025-01-28)


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.7 ([#989](https://github.com/sanity-io/client/issues/989)) ([b36339c](https://github.com/sanity-io/client/commit/b36339c88071ee82d0ec25117a1c9925e623c199))
* **live:** `includeDrafts` no longer require vX ([#991](https://github.com/sanity-io/client/issues/991)) ([22e50aa](https://github.com/sanity-io/client/commit/22e50aa0d62daf5abba8549a56d14240d620fbeb))

## [6.27.1](https://github.com/sanity-io/client/compare/v6.27.0...v6.27.1) (2025-01-22)


### Bug Fixes

* **csm:** handle `Cannot read properties of undefined` ([cb80d68](https://github.com/sanity-io/client/commit/cb80d689f7b0ab4bfc57a3a1c666e947e74fa182))

## [6.27.0](https://github.com/sanity-io/client/compare/v6.26.1...v6.27.0) (2025-01-22)


### Features

* **csm:** support releases in `applySourceDocuments` ([#981](https://github.com/sanity-io/client/issues/981)) ([ab82a35](https://github.com/sanity-io/client/commit/ab82a35e1d37e98aa69c6af7fe3a8959b4057abb))

## [6.26.1](https://github.com/sanity-io/client/compare/v6.26.0...v6.26.1) (2025-01-22)


### Bug Fixes

* **stega:** append `perspective` to edit links ([#979](https://github.com/sanity-io/client/issues/979)) ([65ce82d](https://github.com/sanity-io/client/commit/65ce82dc84765c7a5a189edc64085b5be2d97c9f))
* **stega:** remove `isDraft` search param ([#978](https://github.com/sanity-io/client/issues/978)) ([08d189d](https://github.com/sanity-io/client/commit/08d189dbfd3be6756da07d0b8282dbef769acdd6))

## [6.26.0](https://github.com/sanity-io/client/compare/v6.25.0...v6.26.0) (2025-01-22)


### Features

* **csm:** add document id utils ([#976](https://github.com/sanity-io/client/issues/976)) ([0d4cd76](https://github.com/sanity-io/client/commit/0d4cd76d861178ce1f7ebdc132d5315602141dbc))

## [6.25.0](https://github.com/sanity-io/client/compare/v6.24.4...v6.25.0) (2025-01-17)


### Features

* **request:** add flag to disable logging api warnings ([#925](https://github.com/sanity-io/client/issues/925)) ([3f90ab0](https://github.com/sanity-io/client/commit/3f90ab0faa993e83585caea05f8be654b1149c4a))

## [6.24.4](https://github.com/sanity-io/client/compare/v6.24.3...v6.24.4) (2025-01-16)


### Bug Fixes

* allow mutation selection without passing a patch builder ([#964](https://github.com/sanity-io/client/issues/964)) ([fd70208](https://github.com/sanity-io/client/commit/fd702087ea1dfcbd5937df6e9eeeabe06bf6c52f))
* **deps:** update dependency get-it to ^8.6.6 ([#960](https://github.com/sanity-io/client/issues/960)) ([941203d](https://github.com/sanity-io/client/commit/941203d87acecc24106e68843119fb7d4a8dc2b5))

## [6.24.3](https://github.com/sanity-io/client/compare/v6.24.2...v6.24.3) (2025-01-08)


### Bug Fixes

* **deps:** update non-major ([#955](https://github.com/sanity-io/client/issues/955)) ([37b88bf](https://github.com/sanity-io/client/commit/37b88bf0f00926df7cfaa16c34fe48c522c129ba))

## [6.24.2](https://github.com/sanity-io/client/compare/v6.24.1...v6.24.2) (2025-01-08)


### Bug Fixes

* **deps:** update non-major ([#952](https://github.com/sanity-io/client/issues/952)) ([479ea80](https://github.com/sanity-io/client/commit/479ea80d1955787a83646f1c354b8ee183992379))

## [6.24.1](https://github.com/sanity-io/client/compare/v6.24.0...v6.24.1) (2024-12-03)


### Bug Fixes

* make `validateApiPerspective` a TS asserter ([#936](https://github.com/sanity-io/client/issues/936)) ([baaa62c](https://github.com/sanity-io/client/commit/baaa62c1bcebc7df3a69a842e60a774bf5509fe6))

## [6.24.0](https://github.com/sanity-io/client/compare/v6.23.0...v6.24.0) (2024-12-03)


### Features

* **query:** add support for release perspectives ([#934](https://github.com/sanity-io/client/issues/934)) ([59bd477](https://github.com/sanity-io/client/commit/59bd477e4f9f7fcc8aaead6f37243127e18c96b8))


### Bug Fixes

* export `validateApiPerspective` ([b73ae46](https://github.com/sanity-io/client/commit/b73ae466ddd7b0ee5896fce8a177bae6901c66a5))

## [6.23.0](https://github.com/sanity-io/client/compare/v6.22.5...v6.23.0) (2024-12-02)


### Features

* **query:** add cacheMode support ([#933](https://github.com/sanity-io/client/issues/933)) ([01b6576](https://github.com/sanity-io/client/commit/01b6576662a7485d5ed2c16654f99c0a95033622))


### Bug Fixes

* **types:** add (abort) signal to raw request typings ([#926](https://github.com/sanity-io/client/issues/926)) ([fcd9a16](https://github.com/sanity-io/client/commit/fcd9a1661b48ccf7a0eba70dd53eb9e29f7aef94))

## [6.22.5](https://github.com/sanity-io/client/compare/v6.22.4...v6.22.5) (2024-11-18)


### Bug Fixes

* **stega:** 2x faster encoding of portable text ([#920](https://github.com/sanity-io/client/issues/920)) ([8ae6d30](https://github.com/sanity-io/client/commit/8ae6d30d33d89024887fb4ad9642eca7c40de207))

## [6.22.4](https://github.com/sanity-io/client/compare/v6.22.3...v6.22.4) (2024-11-08)


### Bug Fixes

* **stega:** add `textTheme` to deny list ([39edfe1](https://github.com/sanity-io/client/commit/39edfe12abe453e39659430ab3a1d1272bdffb7b))
* **stega:** ignore paths that end with `Id` ([81aa664](https://github.com/sanity-io/client/commit/81aa66449c718712764d27a90c0e138b482d790b))

## [6.22.3](https://github.com/sanity-io/client/compare/v6.22.2...v6.22.3) (2024-11-06)


### Bug Fixes

* **live:** detect CORS errors ([#910](https://github.com/sanity-io/client/issues/910)) ([553cb38](https://github.com/sanity-io/client/commit/553cb38d291d2f855f6c0be051785d8d5c20f9dd))

## [6.22.2](https://github.com/sanity-io/client/compare/v6.22.1...v6.22.2) (2024-10-17)


### Bug Fixes

* **live:** add `withCredentials` and `tag` support ([#898](https://github.com/sanity-io/client/issues/898)) ([4f882c9](https://github.com/sanity-io/client/commit/4f882c94d5cbf47f9c7b49b4698a9f05ad7c9819))

## [6.22.1](https://github.com/sanity-io/client/compare/v6.22.0...v6.22.1) (2024-10-03)


### Bug Fixes

* add missing `listenerName` property on welcome event ([#894](https://github.com/sanity-io/client/issues/894)) ([6173089](https://github.com/sanity-io/client/commit/6173089839f14a5a0142ef2e96fd58d9a21845a0))

## [6.22.0](https://github.com/sanity-io/client/compare/v6.21.3...v6.22.0) (2024-09-23)


### Features

* **live:** add experimental `includeDrafts` option ([#890](https://github.com/sanity-io/client/issues/890)) ([e1406b1](https://github.com/sanity-io/client/commit/e1406b148ff52a298d93b2d37f8d99576ce4d89a))


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.5 ([#885](https://github.com/sanity-io/client/issues/885)) ([847ad5b](https://github.com/sanity-io/client/commit/847ad5b1c4e2ea9c3cd11b69817b5c386dd8ba26))

## [6.21.3](https://github.com/sanity-io/client/compare/v6.21.2...v6.21.3) (2024-08-14)


### Bug Fixes

* deprecate studioHost, externalStudioHost in typings ([#879](https://github.com/sanity-io/client/issues/879)) ([ebe840b](https://github.com/sanity-io/client/commit/ebe840b156dd433bc9e12c6db3f340e32835dd44))
* support `signal` on `getDocument(s)` to cancel requests ([#881](https://github.com/sanity-io/client/issues/881)) ([13d71bb](https://github.com/sanity-io/client/commit/13d71bb3e3085458bba809e65473166d69c6c376))

## [6.21.2](https://github.com/sanity-io/client/compare/v6.21.1...v6.21.2) (2024-08-09)


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.4 ([#876](https://github.com/sanity-io/client/issues/876)) ([e71b985](https://github.com/sanity-io/client/commit/e71b985d1e9d9e0cbc5cf3731a2886f12a95dbcc))

## [6.21.1](https://github.com/sanity-io/client/compare/v6.21.0...v6.21.1) (2024-07-19)


### Bug Fixes

* add support for includeMutations listen parameter ([#872](https://github.com/sanity-io/client/issues/872)) ([5f0a991](https://github.com/sanity-io/client/commit/5f0a991a2f72632454be7489146c973399008c5d))

## [6.21.0](https://github.com/sanity-io/client/compare/v6.20.2...v6.21.0) (2024-07-11)


### Features

* **codegen:** Allow query reponse types to be overridden through SanityQueries ([#858](https://github.com/sanity-io/client/issues/858)) ([c25d51a](https://github.com/sanity-io/client/commit/c25d51a749a758ebe9886370124fa0bfbd2afe03))

## [6.20.2](https://github.com/sanity-io/client/compare/v6.20.1...v6.20.2) (2024-07-09)


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.3 ([#866](https://github.com/sanity-io/client/issues/866)) ([0661f5d](https://github.com/sanity-io/client/commit/0661f5d59aa9dbb3e10dc00b7fd434fa69ea37f4))

## [6.20.1](https://github.com/sanity-io/client/compare/v6.20.0...v6.20.1) (2024-06-18)


### Bug Fixes

* add warning about setting both useCdn and withCredentials to true ([#849](https://github.com/sanity-io/client/issues/849)) ([ae01edb](https://github.com/sanity-io/client/commit/ae01edbbe16d1cfc00dc474c0a24549c2fe6e076))
* **deps:** update dependency get-it to ^8.6.1 ([#856](https://github.com/sanity-io/client/issues/856)) ([ced69bc](https://github.com/sanity-io/client/commit/ced69bc404463e325a89e0d0e0e55a0464c5cbe1))

## [6.20.0](https://github.com/sanity-io/client/compare/v6.19.2...v6.20.0) (2024-06-10)


### Features

* the `client.live.events()` API is now stable ([#843](https://github.com/sanity-io/client/issues/843)) ([d03fc09](https://github.com/sanity-io/client/commit/d03fc09acb712c7f2007a9821b37d3419e555b34))

## [6.19.2](https://github.com/sanity-io/client/compare/v6.19.1...v6.19.2) (2024-06-10)


### Bug Fixes

* **deps:** update dependency get-it to ^8.6.0 ([#846](https://github.com/sanity-io/client/issues/846)) ([85afc9e](https://github.com/sanity-io/client/commit/85afc9e3501f7c1fb7030e65f4576c42a4857351))

## [6.19.1](https://github.com/sanity-io/client/compare/v6.19.0...v6.19.1) (2024-05-29)


### Bug Fixes

* **types:** adjust action types to reflect Actions API ([#830](https://github.com/sanity-io/client/issues/830)) ([e116c62](https://github.com/sanity-io/client/commit/e116c628b38cb7b2b58b38ef60e615463463795b))

## [6.19.0](https://github.com/sanity-io/client/compare/v6.18.3...v6.19.0) (2024-05-28)


### Features

* add actions API in client ([#818](https://github.com/sanity-io/client/issues/818)) ([03c15a9](https://github.com/sanity-io/client/commit/03c15a9753db6419bc20bd206c10dcca4467052d))

## [6.18.3](https://github.com/sanity-io/client/compare/v6.18.2...v6.18.3) (2024-05-24)


### Bug Fixes

* **deps:** update dependency get-it to ^8.5.0 ([#824](https://github.com/sanity-io/client/issues/824)) ([f4fc8f6](https://github.com/sanity-io/client/commit/f4fc8f64c5050cae148bd86017a570dd1b625b1d))

## [6.18.2](https://github.com/sanity-io/client/compare/v6.18.1...v6.18.2) (2024-05-14)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.30 ([#811](https://github.com/sanity-io/client/issues/811)) ([6598ce8](https://github.com/sanity-io/client/commit/6598ce81945b4cb181ad61cd185c8e8db2468339))

## [6.18.1](https://github.com/sanity-io/client/compare/v6.18.0...v6.18.1) (2024-05-13)


### Bug Fixes

* race condition in `client.listen` memory leak ([#805](https://github.com/sanity-io/client/issues/805)) ([d2e468a](https://github.com/sanity-io/client/commit/d2e468ac2332afe59f50af7111fc00fe4d20e70c))

## [6.18.0](https://github.com/sanity-io/client/compare/v6.17.3...v6.18.0) (2024-05-07)


### Features

* add experimental new live events API ([#797](https://github.com/sanity-io/client/issues/797)) ([de0cec7](https://github.com/sanity-io/client/commit/de0cec7aba29ea754c5a19fa3c16f02b7ee24b8c))

## [6.17.3](https://github.com/sanity-io/client/compare/v6.17.2...v6.17.3) (2024-05-07)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.29 ([#796](https://github.com/sanity-io/client/issues/796)) ([7cfec3e](https://github.com/sanity-io/client/commit/7cfec3e592903c9866845d6b817bb145855e50e2))

## [6.17.2](https://github.com/sanity-io/client/compare/v6.17.1...v6.17.2) (2024-05-03)


### Bug Fixes

* **stega:** remove try/catch block from `stegaClean` ([#788](https://github.com/sanity-io/client/issues/788)) ([06aaad2](https://github.com/sanity-io/client/commit/06aaad2e42ea2a1d30d85abaa0595b61caa49d1e))

## [6.17.1](https://github.com/sanity-io/client/compare/v6.17.0...v6.17.1) (2024-05-03)


### Bug Fixes

* **deps:** update dependency @vercel/stega to v0.1.2 ([#784](https://github.com/sanity-io/client/issues/784)) ([7297ead](https://github.com/sanity-io/client/commit/7297eadce4e5d45287ebd099ad4e4cd4ca1193f1))
* **deps:** update dependency get-it to v8.4.28 ([#786](https://github.com/sanity-io/client/issues/786)) ([47985fc](https://github.com/sanity-io/client/commit/47985fc324bf690db56b61d8114b3027e9990917))
* prevent listener leak on unsubscribe before eventsource module load ([#783](https://github.com/sanity-io/client/issues/783)) ([f38b64e](https://github.com/sanity-io/client/commit/f38b64e4ae0a087839ae64c1de9fce80b24455b5))

## [6.17.0](https://github.com/sanity-io/client/compare/v6.16.0...v6.17.0) (2024-05-02)


### Features

* update SanityProject to include metadata.cliInitializedAt ([#779](https://github.com/sanity-io/client/issues/779)) ([77bf6f6](https://github.com/sanity-io/client/commit/77bf6f6120ea595bb971ac2e7fd5896681b5854d))

## [6.16.0](https://github.com/sanity-io/client/compare/v6.15.20...v6.16.0) (2024-05-02)


### Features

* add `stegaClean` method, deprecate `vercelStegaCleanAll` ([#773](https://github.com/sanity-io/client/issues/773)) ([2749586](https://github.com/sanity-io/client/commit/2749586bf75683c817ad9dfb6e724ad6e28ebec4))


### Bug Fixes

* **deps:** update dependency @vercel/stega to v0.1.1 ([#771](https://github.com/sanity-io/client/issues/771)) ([aea84ce](https://github.com/sanity-io/client/commit/aea84ce2e5d05e3cf3071cd4f6228a8d10595b56))

## [6.15.20](https://github.com/sanity-io/client/compare/v6.15.19...v6.15.20) (2024-04-22)


### Bug Fixes

* **deps:** update dependency @sanity/eventsource to ^5.0.2 ([#754](https://github.com/sanity-io/client/issues/754)) ([754183f](https://github.com/sanity-io/client/commit/754183fbf61f09bc3049c9d8a0eb9904fcce6299))

## [6.15.19](https://github.com/sanity-io/client/compare/v6.15.18...v6.15.19) (2024-04-19)


### Bug Fixes

* handle bug affecting next 14.2.2 during static pregeneration ([#748](https://github.com/sanity-io/client/issues/748)) ([28493e2](https://github.com/sanity-io/client/commit/28493e24f48f4c7f7de3f1caae8958789e49727a))

## [6.15.18](https://github.com/sanity-io/client/compare/v6.15.17...v6.15.18) (2024-04-18)


### Bug Fixes

* allow setting middleware on `requester` ([#742](https://github.com/sanity-io/client/issues/742)) ([65d45be](https://github.com/sanity-io/client/commit/65d45be227cb444358289389f939a68784e24cb0))

## [6.15.17](https://github.com/sanity-io/client/compare/v6.15.16...v6.15.17) (2024-04-17)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.26 ([96ea964](https://github.com/sanity-io/client/commit/96ea9642960ababfc1c65aa91e4dfa92021e605b))

## [6.15.16](https://github.com/sanity-io/client/compare/v6.15.15...v6.15.16) (2024-04-17)


### Bug Fixes

* `createClient` from `@sanity/client/stega` is deprecated ([4d0a03f](https://github.com/sanity-io/client/commit/4d0a03f4954ac00568b6feaef4b3d98fa5dc2984))
* `requester` from `@sanity/client/stega` is deprecated ([f29263d](https://github.com/sanity-io/client/commit/f29263dc5c6649c9df6d256afe7701592ccc65c0))
* use the correct stega export conditions for `react-native` ([06af163](https://github.com/sanity-io/client/commit/06af16360874146dcbca9c4cfaa4deeb35bfb664))

## [6.15.15](https://github.com/sanity-io/client/compare/v6.15.14...v6.15.15) (2024-04-17)


### Bug Fixes

* add `react-native` export conditions ([cc0fd76](https://github.com/sanity-io/client/commit/cc0fd76f066eae0f809cf808e3b4c9ab1f7e4eaf))
* **deps:** update dependency get-it to ^8.4.24 ([0d5952c](https://github.com/sanity-io/client/commit/0d5952c91aeb956e4cf9dc607ab333e49e206b76))

## [6.15.14](https://github.com/sanity-io/client/compare/v6.15.13...v6.15.14) (2024-04-14)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.23 ([#720](https://github.com/sanity-io/client/issues/720)) ([11a6299](https://github.com/sanity-io/client/commit/11a6299b19fd43478d457e97bc398c65df327a01))

## [6.15.13](https://github.com/sanity-io/client/compare/v6.15.12...v6.15.13) (2024-04-11)


### Bug Fixes

* improve bun support ([ac37787](https://github.com/sanity-io/client/commit/ac37787241bd15de1ec4a0a8d49593a5d1db6a20))

## [6.15.12](https://github.com/sanity-io/client/compare/v6.15.11...v6.15.12) (2024-04-11)


### Bug Fixes

* add bun export condition ([57e814f](https://github.com/sanity-io/client/commit/57e814fab8d80e551d513c657bbd9355a602b71a))
* **deps:** update dependency get-it to ^8.4.19 ([#705](https://github.com/sanity-io/client/issues/705)) ([fa3e10c](https://github.com/sanity-io/client/commit/fa3e10c28ac6c4cc8db3fe4dae2bce6c4c6f19b9))

## [6.15.11](https://github.com/sanity-io/client/compare/v6.15.10...v6.15.11) (2024-04-05)


### Bug Fixes

* **stega:** update default filter to skip paths that contain "type" ([#689](https://github.com/sanity-io/client/issues/689)) ([1c6e4ea](https://github.com/sanity-io/client/commit/1c6e4eaa0b1bfd65866e51b476731d75ba0c2aa8))

## [6.15.10](https://github.com/sanity-io/client/compare/v6.15.9...v6.15.10) (2024-04-05)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.18 ([#686](https://github.com/sanity-io/client/issues/686)) ([c4dab41](https://github.com/sanity-io/client/commit/c4dab413fa524db389899356488f46a3ae9fd323))

## [6.15.9](https://github.com/sanity-io/client/compare/v6.15.8...v6.15.9) (2024-04-02)


### Bug Fixes

* **deps:** update dependency terser to ^5.30.2 ([#679](https://github.com/sanity-io/client/issues/679)) ([7ad406b](https://github.com/sanity-io/client/commit/7ad406b12be43d09334fa8481932479f169e1ece))

## [6.15.8](https://github.com/sanity-io/client/compare/v6.15.7...v6.15.8) (2024-04-02)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.16 ([#668](https://github.com/sanity-io/client/issues/668)) ([cea5c1c](https://github.com/sanity-io/client/commit/cea5c1cf5ab331746bc648fda249e4523d2cdecc))
* **deps:** update dependency get-it to ^8.4.17 ([#677](https://github.com/sanity-io/client/issues/677)) ([694298f](https://github.com/sanity-io/client/commit/694298ff914ae433ca8156025fe1bc6cd12aa7fe))

## [6.15.7](https://github.com/sanity-io/client/compare/v6.15.6...v6.15.7) (2024-03-20)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.15 ([#661](https://github.com/sanity-io/client/issues/661)) ([20af691](https://github.com/sanity-io/client/commit/20af6917b3b13998ed8f1de24fd8d1d50a1956b0))

## [6.15.6](https://github.com/sanity-io/client/compare/v6.15.5...v6.15.6) (2024-03-18)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.14 ([#647](https://github.com/sanity-io/client/issues/647)) ([e7c1930](https://github.com/sanity-io/client/commit/e7c19307a3f334f105adda5335121b55f660600e))

## [6.15.5](https://github.com/sanity-io/client/compare/v6.15.4...v6.15.5) (2024-03-15)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.13 ([8c0bb8d](https://github.com/sanity-io/client/commit/8c0bb8de8242db4f63cc58e9c8a734bf6c17df3f))

## [6.15.4](https://github.com/sanity-io/client/compare/v6.15.3...v6.15.4) (2024-03-12)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.11 ([#633](https://github.com/sanity-io/client/issues/633)) ([67ba08a](https://github.com/sanity-io/client/commit/67ba08a6da2a8e36e90e62253e32383b6a9eda7e))

## [6.15.3](https://github.com/sanity-io/client/compare/v6.15.2...v6.15.3) (2024-03-07)


### Bug Fixes

* resolve turbopack regression ([#627](https://github.com/sanity-io/client/issues/627)) ([fdb999a](https://github.com/sanity-io/client/commit/fdb999a468a09dede5e450da88542ddfeb1fbd83))

## [6.15.2](https://github.com/sanity-io/client/compare/v6.15.1...v6.15.2) (2024-03-07)


### Bug Fixes

* remove `module` export condition ([#625](https://github.com/sanity-io/client/issues/625)) ([2a7e81d](https://github.com/sanity-io/client/commit/2a7e81d7f3eab858c827cdf8a763d258d9b08468))

## [6.15.1](https://github.com/sanity-io/client/compare/v6.15.0...v6.15.1) (2024-02-28)


### Bug Fixes

* support turbopack ([76d5e24](https://github.com/sanity-io/client/commit/76d5e247a9226c2709c9c306ced04e3831915286))

## [6.15.0](https://github.com/sanity-io/client/compare/v6.14.4...v6.15.0) (2024-02-26)


### Features

* **csm:** add conditional `isDraft` search parameter to edit urls ([#604](https://github.com/sanity-io/client/issues/604)) ([89783d2](https://github.com/sanity-io/client/commit/89783d2bb96971e7c4f414d51cbc488debc25291))

## [6.14.4](https://github.com/sanity-io/client/compare/v6.14.3...v6.14.4) (2024-02-26)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.10 ([#601](https://github.com/sanity-io/client/issues/601)) ([afeee23](https://github.com/sanity-io/client/commit/afeee23a1d7fbe2e5693f6839e059e53d70021a9))

## [6.14.3](https://github.com/sanity-io/client/compare/v6.14.2...v6.14.3) (2024-02-23)


### Bug Fixes

* **typings:** update `DatasetsResponse` ([#590](https://github.com/sanity-io/client/issues/590)) ([f303f41](https://github.com/sanity-io/client/commit/f303f41b44cc8f1b3bfc7981d464ae0f786640eb))

## [6.14.2](https://github.com/sanity-io/client/compare/v6.14.1...v6.14.2) (2024-02-21)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.8 ([#576](https://github.com/sanity-io/client/issues/576)) ([c88fdf8](https://github.com/sanity-io/client/commit/c88fdf84e6e28129fdfdff9035f0139002a9cdc5))
* **deps:** update dependency get-it to ^8.4.9 ([#586](https://github.com/sanity-io/client/issues/586)) ([63b652c](https://github.com/sanity-io/client/commit/63b652c385c074bd19ffb3f0581c358b4eeb7f77))

## [6.14.1](https://github.com/sanity-io/client/compare/v6.14.0...v6.14.1) (2024-02-21)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.7 ([#568](https://github.com/sanity-io/client/issues/568)) ([a328a6d](https://github.com/sanity-io/client/commit/a328a6dd5d2ebe1a47f6844bec27a6256fe8d830))

## [6.14.0](https://github.com/sanity-io/client/compare/v6.13.3...v6.14.0) (2024-02-19)


### Features

* optionally encode cross dataset reference specific data ([#560](https://github.com/sanity-io/client/issues/560)) ([62a9edb](https://github.com/sanity-io/client/commit/62a9edb6a27686477ad06c13d0ff57bc51ae2165))

## [6.13.3](https://github.com/sanity-io/client/compare/v6.13.2...v6.13.3) (2024-02-14)


### Bug Fixes

* reintroduce support for `returnQuery` option, default to `false` ([dba1696](https://github.com/sanity-io/client/commit/dba1696286abe0ce3f5486133ed7d9ff91b8d8ea))

## [6.13.2](https://github.com/sanity-io/client/compare/v6.13.1...v6.13.2) (2024-02-14)


### Bug Fixes

* revert "add support for `returnQuery` option, default to `false`" ([#545](https://github.com/sanity-io/client/issues/545)) ([e6b4e1c](https://github.com/sanity-io/client/commit/e6b4e1c1c4814815a421fbb5b6457265618aed3b))

## [6.13.1](https://github.com/sanity-io/client/compare/v6.13.0...v6.13.1) (2024-02-14)


### Bug Fixes

* passing array of document ids to patch()/delete() ([#549](https://github.com/sanity-io/client/issues/549)) ([fee7ff7](https://github.com/sanity-io/client/commit/fee7ff7ac717732511111afa5ca1486a9c6dd20b))

## [6.13.0](https://github.com/sanity-io/client/compare/v6.12.4...v6.13.0) (2024-02-14)


### Features

* add support for `returnQuery` option, default to `false` ([#545](https://github.com/sanity-io/client/issues/545)) ([dee015b](https://github.com/sanity-io/client/commit/dee015bbad623c547e333e55a89fcd2dc0b2072d))

## [6.12.4](https://github.com/sanity-io/client/compare/v6.12.3...v6.12.4) (2024-02-08)


### Bug Fixes

* adjust stega logging prefix ([76a8b5e](https://github.com/sanity-io/client/commit/76a8b5ed8e8a5fcbf3c4b07af2ef8a8ac364f30b))

## [6.12.3](https://github.com/sanity-io/client/compare/v6.12.2...v6.12.3) (2024-01-29)


### Bug Fixes

* **typings:** add `ListenParams` for `client.listen` ([dff1bcc](https://github.com/sanity-io/client/commit/dff1bccc86dfdaff71168383ff49468c9faa4d6a))
* **typings:** add `MutationSelectionQueryParams` type ([5bf3eee](https://github.com/sanity-io/client/commit/5bf3eeede1bbd90359c17dcbf36ce7122c057dc3))
* **typings:** improve the QueryParams typing and generics ([#514](https://github.com/sanity-io/client/issues/514)) ([9c606a4](https://github.com/sanity-io/client/commit/9c606a4395a511a02f4c0febeba5444359a74392))

## [6.12.2](https://github.com/sanity-io/client/compare/v6.12.1...v6.12.2) (2024-01-29)


### Bug Fixes

* **typings:** relax query params typings to fix regressions ([#510](https://github.com/sanity-io/client/issues/510)) ([b46583e](https://github.com/sanity-io/client/commit/b46583ee99cf5b50c467c507fece83d9fa4e9519))

## [6.12.1](https://github.com/sanity-io/client/compare/v6.12.0...v6.12.1) (2024-01-26)


### Bug Fixes

* **stega:** resolve issue where strings that ends in numbers are mistaken for datetimes ([6b64cc4](https://github.com/sanity-io/client/commit/6b64cc43babeeed4770ff191bdeffa4070b99266))

## [6.12.0](https://github.com/sanity-io/client/compare/v6.11.3...v6.12.0) (2024-01-26)


### Features

* add stega support to the core client ([#495](https://github.com/sanity-io/client/issues/495)) ([a1abe4a](https://github.com/sanity-io/client/commit/a1abe4a9d1d5e387376117560a9c2a6b1c60e140))


### Bug Fixes

* add guards for common Next.js App Router mistakes ([#499](https://github.com/sanity-io/client/issues/499)) ([323ca33](https://github.com/sanity-io/client/commit/323ca33d422d79abc89bf40c5d4d579c9bbeb604))

## [6.11.3](https://github.com/sanity-io/client/compare/v6.11.2...v6.11.3) (2024-01-25)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.6 ([#488](https://github.com/sanity-io/client/issues/488)) ([9d3131a](https://github.com/sanity-io/client/commit/9d3131a852964aec6688076832bcfe92b216d86d))

## [6.11.2](https://github.com/sanity-io/client/compare/v6.11.1...v6.11.2) (2024-01-23)


### Bug Fixes

* **deps:** update dependency get-it to ^8.4.5 ([#474](https://github.com/sanity-io/client/issues/474)) ([d6d40ff](https://github.com/sanity-io/client/commit/d6d40ff1849a407ed77b5b2d4c0ab02510d2aa4c))
* **stega:** fallback to original value if invalid JSON ([d51963a](https://github.com/sanity-io/client/commit/d51963a6dc747d62e847118a998f879e8752b172))

## [6.11.1](https://github.com/sanity-io/client/compare/v6.11.0...v6.11.1) (2024-01-10)


### Bug Fixes

* **typings:** changed cache doc typing to be `Partial&lt;SanityDocument&gt;`` ([#469](https://github.com/sanity-io/client/issues/469)) ([5483f74](https://github.com/sanity-io/client/commit/5483f744f4428007ca5c697e288390eef7865bc5))

## [6.11.0](https://github.com/sanity-io/client/compare/v6.10.0...v6.11.0) (2024-01-09)


### Features

* **csm:** support perspective modes when optimistically applying document mutations ([#464](https://github.com/sanity-io/client/issues/464)) ([0c9db11](https://github.com/sanity-io/client/commit/0c9db116e231f2fd565a937d759e5f65b8346397))

## [6.10.0](https://github.com/sanity-io/client/compare/v6.9.3...v6.10.0) (2023-12-12)


### Features

* allow setting `useCdn: boolean` on `client.fetch` ([#454](https://github.com/sanity-io/client/issues/454)) ([936ec9e](https://github.com/sanity-io/client/commit/936ec9e7b25b8b24a1829cb0d896d7aa142dbee2))
* **stega:** allow setting `stega` options on `client.fetch` ([#427](https://github.com/sanity-io/client/issues/427)) ([144fc2d](https://github.com/sanity-io/client/commit/144fc2db5bdbf5ec9dbd706843df41069e65dd6b))


### Bug Fixes

* **stega:** strip stega strings from params ([#453](https://github.com/sanity-io/client/issues/453)) ([26ce483](https://github.com/sanity-io/client/commit/26ce48378cfecc732f8b94c70903c09f8e01d383))

## [6.9.3](https://github.com/sanity-io/client/compare/v6.9.2...v6.9.3) (2023-12-07)


### Bug Fixes

* **stega:** add `mode=presentation` to edit intent links ([8f062e1](https://github.com/sanity-io/client/commit/8f062e16711dfe24f1fa697050b3b89b14cd16c8))

## [6.9.2](https://github.com/sanity-io/client/compare/v6.9.1...v6.9.2) (2023-12-07)


### Bug Fixes

* **types:** disambiguate `SanityClient` imports ([#445](https://github.com/sanity-io/client/issues/445)) ([b4b9079](https://github.com/sanity-io/client/commit/b4b9079acac483425e3bd159a3c6b85ab59f562d))

## [6.9.1](https://github.com/sanity-io/client/compare/v6.9.0...v6.9.1) (2023-11-28)


### Bug Fixes

* **stega:** revert allow setting `stega` options on `client.fetch` ([#424](https://github.com/sanity-io/client/issues/424)) ([fdbb57a](https://github.com/sanity-io/client/commit/fdbb57a438c6df26e21cd0b5c9d195ca0935ede9))

## [6.9.0](https://github.com/sanity-io/client/compare/v6.8.6...v6.9.0) (2023-11-28)


### Features

* **stega:** allow setting `stega` options on `client.fetch` ([#419](https://github.com/sanity-io/client/issues/419)) ([d38afd8](https://github.com/sanity-io/client/commit/d38afd8535e287678445b5bb64d83166fb8a602b))

## [6.8.6](https://github.com/sanity-io/client/compare/v6.8.5...v6.8.6) (2023-11-15)


### Bug Fixes

* **stega:** merge stega options in `.config()` and `.withConfig()` ([ef2d282](https://github.com/sanity-io/client/commit/ef2d282cd3558c8705cd64ebb162012502692f04))
* **stega:** remove the `vercelStegaCombineSkip` option ([07b343c](https://github.com/sanity-io/client/commit/07b343c2263dd49404186f48e1e76b769a316626))

## [6.8.5](https://github.com/sanity-io/client/compare/v6.8.4...v6.8.5) (2023-11-13)


### Bug Fixes

* add missing `resultSourceMap` typings ([cddd331](https://github.com/sanity-io/client/commit/cddd33105edd1b1d02317fc1e3da07911fa78c08))

## [6.8.4](https://github.com/sanity-io/client/compare/v6.8.3...v6.8.4) (2023-11-13)


### Bug Fixes

* **csm:** don't apply `tool` to `baseUrl` ([a836c7c](https://github.com/sanity-io/client/commit/a836c7c68b062ddc61824c33e969a06f9ac5a49a))

## [6.8.3](https://github.com/sanity-io/client/compare/v6.8.2...v6.8.3) (2023-11-13)


### Bug Fixes

* **csm:** allow passing a string `path` ([c6c27b8](https://github.com/sanity-io/client/commit/c6c27b893e4d05abc822fc0bd006ecf8da40234f))

## [6.8.2](https://github.com/sanity-io/client/compare/v6.8.1...v6.8.2) (2023-11-13)


### Bug Fixes

* **csm:** remove optional intent resolve parameters ([00b5ffa](https://github.com/sanity-io/client/commit/00b5ffa1bde8f6d33eb060a8582f58c01e8a4968))
* **csm:** remove unused intent resolve parameters ([#397](https://github.com/sanity-io/client/issues/397)) ([00b5ffa](https://github.com/sanity-io/client/commit/00b5ffa1bde8f6d33eb060a8582f58c01e8a4968))

## [6.8.1](https://github.com/sanity-io/client/compare/v6.8.0...v6.8.1) (2023-11-10)


### Bug Fixes

* **stega:** add `href` to `denyList` ([2886ae8](https://github.com/sanity-io/client/commit/2886ae80919fa0f9a4359101522ed4088983e035))
* **stega:** add `secret` to `denyList` ([a2c22d2](https://github.com/sanity-io/client/commit/a2c22d2493ed7e33b7d2d25fa5b8c3b59dd23e2d))

## [6.8.0](https://github.com/sanity-io/client/compare/v6.7.1...v6.8.0) (2023-11-10)


### Features

* **experimental:** add CSM and stega utils ([3e7ecdd](https://github.com/sanity-io/client/commit/3e7ecdd95e61ab0a71537b5fe4cfcaaac1ec3510))

## [6.7.1](https://github.com/sanity-io/client/compare/v6.7.0...v6.7.1) (2023-11-05)


### Bug Fixes

* **deps:** update non-major ([#379](https://github.com/sanity-io/client/issues/379)) ([86222fe](https://github.com/sanity-io/client/commit/86222feb2de3244b8582e5e6a6f626667e1deeda))

## [6.7.0](https://github.com/sanity-io/client/compare/v6.6.0...v6.7.0) (2023-10-19)


### Features

* support `resultSourceMap=withKeyArraySelector` ([#363](https://github.com/sanity-io/client/issues/363)) ([d528e99](https://github.com/sanity-io/client/commit/d528e99f7f25077e9acc9909a642af352782359c))

## [6.6.0](https://github.com/sanity-io/client/compare/v6.5.0...v6.6.0) (2023-10-12)


### Features

* **types:** add `_type` to `ContentSourceMapDocuments` ([#358](https://github.com/sanity-io/client/issues/358)) ([1acf6c5](https://github.com/sanity-io/client/commit/1acf6c5a111ad311ffc935956c064c87c51ad53c))

## [6.5.0](https://github.com/sanity-io/client/compare/v6.4.12...v6.5.0) (2023-10-10)


### Features

* allow passing null as tag to explicitly disable it ([#348](https://github.com/sanity-io/client/issues/348)) ([2698bde](https://github.com/sanity-io/client/commit/2698bdee034d36d8ff59c9984bf6069a385af850))

## [6.4.12](https://github.com/sanity-io/client/compare/v6.4.11...v6.4.12) (2023-09-13)


### Bug Fixes

* setup release-please ([#330](https://github.com/sanity-io/client/issues/330)) ([b20b109](https://github.com/sanity-io/client/commit/b20b109e0a4ec95c967e5f794d6dbf93550877de))

## [6.4.11](https://github.com/sanity-io/client/compare/v6.4.10...v6.4.11) (2023-09-06)

### Bug Fixes

- adjust incorrect listener `visibility` option type ([#317](https://github.com/sanity-io/client/issues/317)) ([92ac2a6](https://github.com/sanity-io/client/commit/92ac2a6879b1f92cb756fc7b54a04fd98e38f81e))
- remove deprecated annotation for the request method ([#320](https://github.com/sanity-io/client/issues/320)) ([8d8f0e2](https://github.com/sanity-io/client/commit/8d8f0e24d9ddf2e5e41f213e9c4f49ae287dd061))

## [6.4.10](https://github.com/sanity-io/client/compare/v6.4.9...v6.4.10) (2023-09-06)

### Bug Fixes

- **esm:** support `nuxt-module-build` ([#318](https://github.com/sanity-io/client/issues/318)) ([d279283](https://github.com/sanity-io/client/commit/d279283d4298b5ae532f9262f32f5489b3fb71b8))

## [6.4.9](https://github.com/sanity-io/client/compare/v6.4.8...v6.4.9) (2023-08-18)

### Bug Fixes

- set `useCdn: false` automatically when `perspective: 'previewDrafts'` ([#299](https://github.com/sanity-io/client/issues/299)) ([0cb98cf](https://github.com/sanity-io/client/commit/0cb98cffb18a217b9c08ed6bd55fce351e0e766c))

## [6.4.8](https://github.com/sanity-io/client/compare/v6.4.7...v6.4.8) (2023-08-18)

### Bug Fixes

- **docs:** add Next.js App Router example ([#300](https://github.com/sanity-io/client/issues/300)) ([d0d432c](https://github.com/sanity-io/client/commit/d0d432c1abdba66dbf806adc5d4cce582f6763e3))

## [6.4.7](https://github.com/sanity-io/client/compare/v6.4.6...v6.4.7) (2023-08-17)

### Bug Fixes

- don't set `signal` on `fetch` unless provided to `client.fetch` ([#298](https://github.com/sanity-io/client/issues/298)) ([e1d5210](https://github.com/sanity-io/client/commit/e1d5210a438ea0adfd6acb872f48e2a672c2d1b1))

## [6.4.6](https://github.com/sanity-io/client/compare/v6.4.5...v6.4.6) (2023-08-13)

### Bug Fixes

- **client.fetch:** allow setting `perspective` and `resultSourceMap` on fetch ([18eedfd](https://github.com/sanity-io/client/commit/18eedfdd820567b263ef5d82972fd2f7afea49cf))

## [6.4.5](https://github.com/sanity-io/client/compare/v6.4.4...v6.4.5) (2023-08-09)

### Bug Fixes

- **deps:** update dependency get-it to ^8.4.2 ([#290](https://github.com/sanity-io/client/issues/290)) ([d753ba0](https://github.com/sanity-io/client/commit/d753ba03fcda812de1984fcc20cfb75611650538)), closes [#287](https://github.com/sanity-io/client/issues/287)

## [6.4.4](https://github.com/sanity-io/client/compare/v6.4.3...v6.4.4) (2023-08-08)

### Bug Fixes

- restore React Native compatibility ([#286](https://github.com/sanity-io/client/issues/286)) ([dd1cb97](https://github.com/sanity-io/client/commit/dd1cb97330f46a2475a139d4cf3e87084d6be031))

## [6.4.3](https://github.com/sanity-io/client/compare/v6.4.2...v6.4.3) (2023-08-07)

### Bug Fixes

- add `react-server` export condition ([3a81261](https://github.com/sanity-io/client/commit/3a81261975e55ef2afe48596288d0d0e95db17bd))

## [6.4.2](https://github.com/sanity-io/client/compare/v6.4.1...v6.4.2) (2023-08-07)

### Bug Fixes

- support Gatsby v5 ([ef24109](https://github.com/sanity-io/client/commit/ef241090ee2679a1ba438e1e80c88dcac9627245)), closes [#206](https://github.com/sanity-io/client/issues/206)

## [6.4.1](https://github.com/sanity-io/client/compare/v6.4.0...v6.4.1) (2023-08-07)

### Bug Fixes

- add `node.module` export condition ([6ec1d7e](https://github.com/sanity-io/client/commit/6ec1d7ebfff30a166b8b70316cac02e6077ecfb0))

## [6.4.0](https://github.com/sanity-io/client/compare/v6.3.0...v6.4.0) (2023-08-02)

### Features

- limit the number of connections open in Node.js ([#271](https://github.com/sanity-io/client/issues/271)) ([7d3d537](https://github.com/sanity-io/client/commit/7d3d53793f976127fad85d75e307d007f7cc8ae5))

## [6.3.0](https://github.com/sanity-io/client/compare/v6.2.0...v6.3.0) (2023-08-01)

### Features

- **projects:** `includeMembers` option on `projects.list()` ([#273](https://github.com/sanity-io/client/issues/273)) ([5f14eaf](https://github.com/sanity-io/client/commit/5f14eaf9229f5750bf674efebe2885a985476b7a))

## [6.2.0](https://github.com/sanity-io/client/compare/v6.1.7...v6.2.0) (2023-07-26)

### Features

- support `fetch` for Next.js `app-router` ([#249](https://github.com/sanity-io/client/issues/249)) ([0aa4c6d](https://github.com/sanity-io/client/commit/0aa4c6dd9e7ec5cebc9847f7a5e0101a9c4a316d))

## [6.1.7](https://github.com/sanity-io/client/compare/v6.1.6...v6.1.7) (2023-07-07)

### Bug Fixes

- validate `perspective` config ([#252](https://github.com/sanity-io/client/issues/252)) ([d6e0630](https://github.com/sanity-io/client/commit/d6e06309dbe29a4a3a85373e4635f538510051b2))

## [6.1.6](https://github.com/sanity-io/client/compare/v6.1.5...v6.1.6) (2023-07-04)

### Bug Fixes

- add GROQ query params when large POST queries ([#255](https://github.com/sanity-io/client/issues/255)) ([4e7a5de](https://github.com/sanity-io/client/commit/4e7a5deb51098293200f97ccabc12a40194dde39))

## [6.1.5](https://github.com/sanity-io/client/compare/v6.1.4...v6.1.5) (2023-06-29)

### Bug Fixes

- **docs:** add `perspective` documentation ([#240](https://github.com/sanity-io/client/issues/240)) ([8e79e54](https://github.com/sanity-io/client/commit/8e79e54937b92b05f6f6bd98a27fe67a93bbb5e0))

## [6.1.4](https://github.com/sanity-io/client/compare/v6.1.3...v6.1.4) (2023-06-29)

### Bug Fixes

- check if `@sanity/preview-kit/client` is incorrectly setup ([2507638](https://github.com/sanity-io/client/commit/25076383aa5507975d413bc35b51135dc5173046))
- **deps:** update dependency get-it to v8.1.4 ([#250](https://github.com/sanity-io/client/issues/250)) ([09f89ea](https://github.com/sanity-io/client/commit/09f89ea7daca214a43cdf2ef877a8c51d32d7acc))
- **deps:** update non-major ([#251](https://github.com/sanity-io/client/issues/251)) ([07935ec](https://github.com/sanity-io/client/commit/07935ecef329f82e3895804eaa31671f233fe9dc))

## [6.1.3](https://github.com/sanity-io/client/compare/v6.1.2...v6.1.3) (2023-06-12)

### Bug Fixes

- add `ClientPerspective` type export ([4c8664d](https://github.com/sanity-io/client/commit/4c8664d7673771c3960648d2f8317942e22fbd1c))
- update `perspective` typings ([74a02f8](https://github.com/sanity-io/client/commit/74a02f85cb344418757d19ab50d22dcf21526fd6))

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
