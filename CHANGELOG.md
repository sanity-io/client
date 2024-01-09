<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
