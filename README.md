# @sanity/client

[![npm stat](https://img.shields.io/npm/dm/@sanity/client.svg?style=flat-square)](https://npm-stat.com/charts.html?package=@sanity/client)
[![npm version](https://img.shields.io/npm/v/@sanity/client.svg?style=flat-square)](https://www.npmjs.com/package/@sanity/client)
[![gzip size][gzip-badge]][bundlephobia]
[![size][size-badge]][bundlephobia]

JavaScript client for Sanity. Works in modern browsers, as well as runtimes like [Node.js], [Bun], [Deno], and [Edge Runtime]

## QuickStart

Install the client with a package manager:

```sh
npm install @sanity/client
```

Import and create a new client instance, and use its methods to interact with your project's [Content Lake]. Below are some simple examples in plain JavaScript. Read further for more comprehensive documentation.

```js
// sanity.js
import {createClient} from '@sanity/client'
// Import using ESM URL imports in environments that supports it:
// import {createClient} from 'https://esm.sh/@sanity/client'

export const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  // Set default headers to be included with all requests
  headers: {
    'X-Custom-Header': 'custom-value'
  },
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
  // token: process.env.SANITY_SECRET_TOKEN // Needed for certain operations like updating content, accessing drafts or using draft perspectives
})

// uses GROQ to query content: https://www.sanity.io/docs/groq
export async function getPosts() {
  const posts = await client.fetch('*[_type == "post"]')
  return posts
}

export async function createPost(post: Post) {
  const result = client.create(post)
  return result
}

export async function updateDocumentTitle(_id, title) {
  const result = client.patch(_id).set({title})
  return result
}
```

# Table of contents

- [QuickStart](#quickstart)
- [Requirements](#requirements)
- [Installation](#installation)
- [API](#api)
  - [Creating a client instance](#creating-a-client-instance)
    - [ESM](#esm)
    - [CommonJS](#commonjs)
    - [TypeScript](#typescript)
    - [Next.js App Router](#nextjs-app-router)
    - [Bun](#bun)
    - [Deno](#deno)
    - [Edge Runtime](#edge-runtime)
    - [Browser ESM CDN](#browser-esm-cdn)
    - [UMD](#umd)
  - [Specifying API version](#specifying-api-version)
  - [Request tags](#request-tags)
  - [Performing queries](#performing-queries)
  - [Using perspectives](#using-perspectives)
    - [`published`](#published)
    - [`drafts`](#drafts)
    - [`raw`](#raw)
  - [Fetching Content Source Maps](#fetching-content-source-maps)
    - [Using Visual editing with steganography](#using-visual-editing-with-steganography)
    - [Creating Studio edit intent links](#creating-studio-edit-intent-links)
  - [Listening to queries](#listening-to-queries)
  - [Fetch a single document](#fetch-a-single-document)
  - [Fetch multiple documents in one go](#fetch-multiple-documents-in-one-go)
  - [Creating documents](#creating-documents)
  - [Creating/replacing documents](#creatingreplacing-documents)
  - [Creating if not already present](#creating-if-not-already-present)
  - [Patch/update a document](#patchupdate-a-document)
  - [Setting a field only if not already present](#setting-a-field-only-if-not-already-present)
  - [Removing/unsetting fields](#removingunsetting-fields)
  - [Incrementing/decrementing numbers](#incrementingdecrementing-numbers)
  - [Patch a document only if revision matches](#patch-a-document-only-if-revision-matches)
  - [Adding elements to an array](#adding-elements-to-an-array)
  - [Appending/prepending elements to an array](#appendingprepending-elements-to-an-array)
  - [Deleting an element from an array](#deleting-an-element-from-an-array)
  - [Delete documents](#delete-documents)
  - [Multiple mutations in a transaction](#multiple-mutations-in-a-transaction)
  - [Clientless patches \& transactions](#clientless-patches--transactions)
  - [Release and version operations](#release-and-version-operations)
  - [Uploading assets](#uploading-assets)
    - [Examples: Uploading assets from Node.js](#examples-uploading-assets-from-nodejs)
    - [Examples: Uploading assets from the Browser](#examples-uploading-assets-from-the-browser)
    - [Examples: Specify image metadata to extract](#examples-specify-image-metadata-to-extract)
  - [Deleting an asset](#deleting-an-asset)
  - [Mutation options](#mutation-options)
  - [Aborting a request](#aborting-a-request)
    - [1. Abort a request by passing an AbortSignal with the request options](#1-abort-a-request-by-passing-an-abortsignal-with-the-request-options)
    - [2. Cancel a request by unsubscribing from the Observable](#2-cancel-a-request-by-unsubscribing-from-the-observable)
  - [Get client configuration](#get-client-configuration)
  - [Set client configuration](#set-client-configuration)
  - [Actions](#actions)
    - [Action options](#action-options)
    - [Create Action](#create-action)
    - [Delete Action](#delete-action)
    - [Edit Action](#edit-action)
    - [Publish Action](#publish-action)
    - [Unpublish Action](#unpublish-action)
    - [Version actions](#version-actions)
      - [Create Version Action](#create-version)
      - [Discard Version Action](#discard-version)
      - [Replace Version Action](#replace-version)
      - [Unpublish Version Action](#unpublish-action)
    - [Release Actions](#release-actions)
      - [Create Release Action](#create-release)
      - [Edit Release Action](#edit-release)
      - [Published Release Action](#publish-release)
      - [Schedule Release Action](#schedule-release)
      - [Unschedule Release Action](#unarchive-release)
      - [Archive Release Action](#archive-release)
      - [Unarchive Release Action](#unarchive-release)
      - [Delete Release Action](#delete-release)
  - [Agent Actions](#agent-actions-api)
    - [Overview](#overview)
    - [Generating Content](#generating-content)
      - [Generating images](#generating-images)
      - [Example: Using GROQ in instructionParams](#example-using-groq-in-instructionparams)
      - [Example: Using the async flag](#example-using-the-async-flag)
    - [Transforming Documents](#transforming-documents)
      - [Transforming images](#transforming-images)
      - [Image descriptions](#image-descriptions)
      - [Example: Field-based transformation](#example-field-based-transformation)
    - [Translating Documents](#translating-documents)
      - [Example: Storing language in a field](#example-storing-language-in-a-field)
    - [Prompt the LLM](#prompt-the-llm)
    - [Patch with a schema-aware API](#patch-with-a-schema-aware-api)
  - [Media Library API](#media-library-api)
    - [Getting video playback information](#getting-video-playback-information)
    - [Working with signed playback information](#working-with-signed-playback-information)
- [License](#license)
- [From `v5`](#from-v5)
  - [The default `useCdn` is changed to `true`](#the-default-usecdn-is-changed-to-true)
- [From `v4`](#from-v4)
  - [No longer shipping `ES5`](#no-longer-shipping-es5)
  - [Node.js `v12` no longer supported](#nodejs-v12-no-longer-supported)
  - [The `default` export is replaced with the named export `createClient`](#the-default-export-is-replaced-with-the-named-export-createclient)
  - [`client.assets.delete` is removed](#clientassetsdelete-is-removed)
  - [`client.assets.getImageUrl` is removed, replace with `@sanity/image-url`](#clientassetsgetimageurl-is-removed-replace-with-sanityimage-url)
  - [`SanityClient` static properties moved to named exports](#sanityclient-static-properties-moved-to-named-exports)
  - [`client.clientConfig` is removed, replace with `client.config()`](#clientclientconfig-is-removed-replace-with-clientconfig)
  - [`client.isPromiseAPI()` is removed, replace with an `instanceof` check](#clientispromiseapi-is-removed-replace-with-an-instanceof-check)
  - [`client.observable.isObservableAPI()` is removed, replace with an `instanceof` check](#clientobservableisobservableapi-is-removed-replace-with-an-instanceof-check)
  - [`client._requestObservable` is removed, replace with `client.observable.request`](#client_requestobservable-is-removed-replace-with-clientobservablerequest)
  - [`client._dataRequest` is removed, replace with `client.dataRequest`](#client_datarequest-is-removed-replace-with-clientdatarequest)
  - [`client._create_` is removed, replace with one of `client.create`, `client.createIfNotExists` or `client.createOrReplace`](#client_create_-is-removed-replace-with-one-of-clientcreate-clientcreateifnotexists-or-clientcreateorreplace)
  - [`client.patch.replace` is removed, replace with `client.createOrReplace`](#clientpatchreplace-is-removed-replace-with-clientcreateorreplace)
  - [`client.auth` is removed, replace with `client.request`](#clientauth-is-removed-replace-with-clientrequest)

## Requirements

Sanity Client transpiles syntax for [modern browsers]. The JavaScript runtime must support ES6 features such as [class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [rest parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters), [spread syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) and more. Most modern web frameworks, [browsers][modern browsers], and developer tooling supports ES6 today.

[For legacy ES5 environments we recommend v4.](https://github.com/sanity-io/client/tree/v4.0.0#sanityclient)

## Installation

The client can be installed from [npm]:

```sh
npm install @sanity/client

# Alternative package managers
yarn add @sanity/client
pnpm install @sanity/client
```

## API

### Creating a client instance

`const client = createClient(options)`

Initializes a new Sanity Client. Required options are `projectId`, `dataset`, and `apiVersion`. [We encourage setting `useCdn` to either `true` or `false`.](https://www.sanity.io/help/js-client-cdn-configuration) The default is `true`. If you're not sure which option to choose we recommend starting with `true` and revise later if you find that you require uncached content. [Our awesome Slack community can help guide you on how to avoid stale data tailored to your tech stack and architecture.](https://slack.sanity.io/)

#### [ESM](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/)

```js
import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

const data = await client.fetch(`count(*)`)
console.log(`Number of documents: ${data}`)
```

#### [CommonJS]

```js
const {createClient} = require('@sanity/client')

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

client
  .fetch(`count(*)`)
  .then((data) => console.log(`Number of documents: ${data}`))
  .catch(console.error)
```

#### [TypeScript]

```ts
import {createClient, type ClientConfig} from '@sanity/client'

const config: ClientConfig = {
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
}
const client = createClient(config)

const data = await client.fetch<number>(`count(*)`)
// data is typed as `number`
console.log(`Number of documents: ${data}`)
```

We're currently exploring typed GROQ queries that are runtime safe, and will share more when we've landed on a solution we're satisifed with.
Until then you can achieve this using [Zod]:

```ts
import {createClient} from '@sanity/client'
import {z} from 'zod'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

const schema = z.number()
const data = schema.parse(await client.fetch(`count(*)`))
// data is guaranteed to be `number`, or zod will throw an error
console.log(`Number of documents: ${data}`)
```

Another alternative is [groqd].

#### [Next.js App Router](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating#fetching-data-on-the-server-with-fetch)

```tsx
import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

export default async function ReactServerComponent() {
  const data = await client.fetch<number>(
    `count(*[_type == "page"])`,
    {},
    {
      // You can set any of the `cache` and `next` options as you would on a standard `fetch` call
      cache: 'force-cache',
      next: {tags: ['pages']},
    },
  )

  return <h1>Number of pages: {data}</h1>
}
```

The `cache` and `next` options are documented in the [Next.js documentation](https://nextjs.org/docs/app/api-reference/functions/fetch#fetchurl-options).
Since [request memoization](https://nextjs.org/docs/app/building-your-application/caching#request-memoization) is supported it's unnecessary to use [the `React.cache`](https://nextjs.org/docs/app/building-your-application/caching#react-cache-function) API.
To [opt-out of memoization](https://nextjs.org/docs/app/building-your-application/caching#opting-out), set the `signal` property:

```tsx
const {signal} = new AbortController()
// By passing `signal` this request will not be memoized and `now()` will execute for every React Server Component that runs this query
const data = await client.fetch<number>(`{"dynamic": now()}`, {}, {signal})
```

#### [Bun]

```bash
bun init
bun add @sanity/client
open index.ts
```

```ts
// index.ts
import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

const data = await client.fetch<number>(`count(*)`)

console.write(`Number of documents: ${data}`)
```

```bash
bun run index.ts
# Number of documents ${number}
```

#### [Deno]

```bash
deno init
open main.ts
```

```ts
// main.ts
import {createClient} from 'https://esm.sh/@sanity/client'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

const data = await client.fetch<number>(`count(*)`)

console.log(`Number of documents: ${data}`)
```

```bash
deno run --allow-net --allow-env main.ts
# Number of documents ${number}
```

#### [Edge Runtime]

```bash
npm install next
```

```ts
// pages/api/total.ts
import {createClient} from '@sanity/client'
import type {NextRequest} from 'next/server'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: NextRequest) {
  const client = createClient({
    projectId: 'your-project-id',
    dataset: 'your-dataset-name',
    useCdn: true, // set to `false` to bypass the edge cache
    apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
  })

  const count = await client.fetch<number>(`count(*)`)
  return new Response(JSON.stringify({count}), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })
}
```

```bash
npx next dev
# Open http://localhost:3000/api/total
# {"count": number}
```

#### Browser ESM CDN

Using [esm.sh] you can either load the client using a `<script type="module">` tag:

```html
<script type="module">
  import {createClient} from 'https://esm.sh/@sanity/client'

  const client = createClient({
    projectId: 'your-project-id',
    dataset: 'your-dataset-name',
    useCdn: true, // set to `false` to bypass the edge cache
    apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
  })

  const data = await client.fetch(`count(*)`)
  document.getElementById('results').innerText = `Number of documents: ${data}`
</script>
<div id="results"></div>
```

Or from anywhere using a dynamic `import()`:

```js
// You can run this snippet from your browser DevTools console.
// Super handy when you're quickly testing out queries.
const {createClient} = await import('https://esm.sh/@sanity/client')
const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  useCdn: true, // set to `false` to bypass the edge cache
  apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
})

const data = await client.fetch(`count(*)`)
console.log(`Number of documents: ${data}`)
```

#### [UMD][unpkg-dist]

Loading the UMD script creates a `SanityClient` global that have the same exports as `import * as SanityClient from '@sanity/client'`:

```html
<script src="https://unpkg.com/@sanity/client"></script>
<!-- Unminified build for debugging -->
<!--<script src="https://unpkg.com/@sanity/client/umd/sanityClient.js"></script>-->
<script>
  const {createClient} = SanityClient

  const client = createClient({
    projectId: 'your-project-id',
    dataset: 'your-dataset-name',
    useCdn: true, // set to `false` to bypass the edge cache
    apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
  })

  client.fetch(`count(*)`).then((data) => console.log(`Number of documents: ${data}`))
</script>
```

The `require-unpkg` library lets you consume `npm` packages from `unpkg.com` similar to how `esm.sh` lets you `import()` anything:

```html
<div id="results"></div>
<script src="https://unpkg.com/require-unpkg"></script>
<script>
  ;(async () => {
    // const {createClient} = await require('@sanity/client')
    const [$, {createClient}] = await require(['jquery', '@sanity/client'])

    const client = createClient({
      projectId: 'your-project-id',
      dataset: 'your-dataset-name',
      useCdn: true, // set to `false` to bypass the edge cache
      apiVersion: '2025-02-06', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
    })

    const data = await client.fetch(`count(*)`)
    $('#results').text(`Number of documents: ${data}`)
  })()
</script>
```

### Specifying API version

Sanity uses ISO dates (YYYY-MM-DD) in UTC timezone for versioning. The explanation for this can be found [in the documentation][api-versioning]

In general, unless you know what API version you want to use, you'll want to statically set it to today's UTC date when starting a new project. By doing this, you'll get all the latest bugfixes and features, while locking the API to prevent breaking changes.

**Note**: Do not be tempted to use a dynamic value for the `apiVersion`. The reason for setting a static value is to prevent unexpected, breaking changes.

In future versions, specifying an API version will be required. For now (to maintain backwards compatiblity) not specifying a version will trigger a deprecation warning and fall back to using `v1`.

### Request tags

Request tags are values assigned to API and CDN requests that can be used to filter and aggregate log data within [request logs][request-logs] from your Sanity Content Lake.

Sanity Client has out-of-the-box support for tagging every API and CDN request on two levels:

- Globally: Using the `requestTagPrefix` client configuration parameter
- Per Request: Pass the tag option to the SDK’s Request method.

The following example will result in a query with `tag=website.landing-page`:

```ts
const client = createClient({
  projectId: '<project>',
  dataset: '<dataset>',
  useCdn: true,
  apiVersion: '2025-02-06',
  requestTagPrefix: 'website', // Added to every request
})

const posts = await client.fetch('*[_type == "post"]', {
  tag: `index-page`, // Appended to requestTagPrefix for this individual request
})
```

### Performing queries

```js
const query = '*[_type == "bike" && seats >= $minSeats] {name, seats}'
const params = {minSeats: 2}

client.fetch(query, params).then((bikes) => {
  console.log('Bikes with more than one seat:')
  bikes.forEach((bike) => {
    console.log(`${bike.name} (${bike.seats} seats)`)
  })
})
```

`client.fetch(query, params = {})`

Perform a query using the given parameters (if any).

### Using perspectives

Use the `perspective` option to filter queries from a specific viewpoint. The default value is [`published`](#published) if API version >= v2025-02-19, (if API version is < v2025-02-19, [`raw`](#raw) is the default). Using the [`published`](#published) perspective will exclude drafts, versions, and potential future document variants. Using the [`raw`](#raw) perspective returns all document variants, so it's recommended to apply additional client side filtering to limit the variants you want to process.

Learn more about using perspectives with Content Releases in the [perspective documentation](https://www.sanity.io/docs/perspectives).

#### `published`

Useful for when you want to be sure that draft documents are not returned in production. Pairs well with private datasets.

With a dataset that looks like this:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King"
  }
]
```

And a query like this:

```ts
import {createClient} from '@sanity/client'

const client = createClient({
  ...config,
  useCdn: true, // set to `false` to bypass the edge cache
  perspective: 'published', // default starting from API version v2025-02-19
})

const authors = await client.fetch('*[_type == "author"]')
```

Then `authors` will only contain published documents, and not include documents with `drafts.`, `versions.` or other prefixes in their `_id`, in this case just "George Martin":

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George Martin"
  }
]
```

#### `drafts`

> Note: this was previously named `previewDrafts`. The `previewDrafts` perspective is still supported, but deprecated and may be removed in a future API version, so we recommend changing to `drafts`.

Designed to help answer the question "What is our app going to look like after all the draft documents are published?".

Given a dataset like this:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King"
  },
  {
    "_type": "author",
    "_id": "6b3792d2-a9e8-4c79-9982-c7e89f2d1e75",
    "name": "Terry Pratchett"
  }
]
```

And a query like this:

```ts
import {createClient} from '@sanity/client'

const client = createClient({
  ...config,
  useCdn: false, // the `drafts` perspective requires this to be `false`
  perspective: 'drafts',
})

const authors = await client.fetch('*[_type == "author"]')
```

Then `authors` will look like this. Note that the result dedupes documents with a preference for the draft version:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "_originalId": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "_originalId": "drafts.f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King"
  },
  {
    "_type": "author",
    "_id": "6b3792d2-a9e8-4c79-9982-c7e89f2d1e75",
    "_originalId": "6b3792d2-a9e8-4c79-9982-c7e89f2d1e75",
    "name": "Terry Pratchett"
  }
]
```

Since the query simulates what the result will be after publishing the drafts, the `_id` doesn't contain the `drafts.` prefix. If you want to check if a document is a draft or not you can use the `_originalId` field, which is only available when using the `drafts` perspective.

```ts
const authors = await client.fetch(`*[_type == "author"]{..., "status": select(
  _originalId in path("drafts.**") => "draft",
  "published"
)}`)
```

Which changes the result to be:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "_originalId": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin",
    "status": "draft"
  },
  {
    "_type": "author",
    "_id": "f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "_originalId": "f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King",
    "status": "published"
  }
]
```

#### `raw`

Designed for working with all variations of documents, including, but not limited to, drafts and versions.

Given a dataset like this:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "versions.r273M8K2Q.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King"
  }
]
```

And a query like this:

```ts
import {createClient} from '@sanity/client'

const client = createClient({
  ...config,
  useCdn: false, // the `raw` perspective can be used with CDN, but versions and drafts will not be returned unless a token is provided
  perspective: 'raw',
})

const authors = await client.fetch('*[_type == "author"]')
```

Then `authors` will include the complete set:

```json
[
  {
    "_type": "author",
    "_id": "ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "versions.r273M8K2Q.ecfef291-60f0-4609-bbfc-263d11a48c43",
    "name": "George R.R. Martin"
  },
  {
    "_type": "author",
    "_id": "drafts.f4898efe-92c4-4dc0-9c8c-f7480aef17e2",
    "name": "Stephen King"
  }
]
```

Currently, Sanity supports two types of document variations: drafts and versions. Drafts and versions will not be visible to queries as long as the client is unauthenticated.
However, using the `raw` perspective with an authenticated client will cause both drafts and versions to appear in query results, so if using `raw` with an authenticated client, make sure this is the behavior you want.

Also keep in mind that additional document variations may be introduced by Sanity in the future.

### Fetching Content Source Maps

Content Source Maps annotate fragments in your query results with metadata about its origin: the field, document, and dataset it originated from.

> [!IMPORTANT]
>
> Content Source Maps are supported in the Content Lake API versions `2021-03-25` and later.

Before diving in, review the [Content Source Maps introduction][content-source-maps-intro] and keep the [Content Source Maps reference][content-source-maps] within reach for a quick lookup.

Enabling Content Source Maps is a two-step process:

1. Update your client configuration with `resultSourceMap`.

   ```js
   import {createClient} from '@sanity/client'

   const client = createClient({
     projectId: 'your-project-id',
     dataset: 'your-dataset-name',
     useCdn: true, // set to `false` to bypass the edge cache
     apiVersion: '2021-03-25', // use current date (YYYY-MM-DD) to target the latest API version
     resultSourceMap: true, // tells the API to start sending source maps, if available
   })
   ```

2. On `client.fetch` calls add `{filterResponse: false}` to return the full response on queries.

   ```js
   // Before
   // const result = await client.fetch(query, params)

   // After adding `filterResponse: false`
   const {result, resultSourceMap} = await client.fetch(query, params, {filterResponse: false})
   // Build something cool with the source map
   console.log(resultSourceMap)
   ```

If your `apiVersion` is `2021-03-25` or later, the `resultSourceMap` property will always exist in the response after enabling it. If there is no source map, `resultSourceMap` is an empty object.
This is the corresponding TypeScript definition:

```ts
import type {ContentSourceMapping} from '@sanity/client'

const {result, resultSourceMap} = await client.fetch(query, params, {filterResponse: false})

function useContentSourceMap(resultSourceMap: ContentSourceMapping): unknown {
  // Sky's the limit
}

useContentSourceMap(resultSourceMap)
```

#### Using [Visual editing][visual-editing] with steganography

A turnkey integration with [Visual editing][visual-editing] is available in [`@sanity/client`], with additional utils available on [`@sanity/client/stega`]. It creates edit intent links for all the string values in your query result, using [steganography](https://npmjs.com/package/@vercel/stega) under the hood. The code that handles stega is lazy loaded on demand when `client.fetch` is called, if `client.config().stega.enabled` is `true`.

```ts
import {createClient} from '@sanity/client'

const client = createClient({
  // ...base config options
  stega: {
    // If you use Vercel Visual Editing, we recommend enabling it for Preview deployments
    enabled: process.env.VERCEL_ENV === 'preview',
    // Required: Set it to the relative or absolute URL of your Sanity Studio instance
    studioUrl: '/studio', // or 'https://your-project-name.sanity.studio'
    // To resolve Cross Dataset References, pass a function returning a URL
    studioUrl: (sourceDocument: ContentSourceMapDocument | ContentSourceMapRemoteDocument) => {
      // If `sourceDocument` has a projectId and a dataset, then it's a Cross Dataset Reference
      if (source._projectId && source._dataset) {
        return 'https://acme-global.sanity.studio'
      }
      return 'https://acme-store.sanity.studio'
    },
    // If your Studio has Workspaces: https://www.sanity.io/docs/workspaces
    // and if your Cross Dataset References are available in a workspace, you can return an object to let the client set up the URL
    studioUrl: (sourceDocument) => {
      // This organization has a single studio with everything organized in workspaces
      const baseUrl = 'https://acme.sanity.studio'
      // If `sourceDocument` has a projectId and a dataset, then it's a Cross Dataset Reference
      if (source._projectId && source._dataset) {
        return {baseUrl, workspace: 'global'}
      }
      return {baseUrl, workspace: 'store'}
    },

    // Optional, to control which fields have stega payloads
    filter: (props) => {
      const {resultPath, sourcePath, sourceDocument, value} = props
      if (sourcePath[0] === 'externalurl') {
        return false
      }
      // The default behavior is packaged into `filterDefault`, allowing you to enable encoding fields that are skipped by default
      return props.filterDefault(props)
    },

    // Optional, to log what's encoded and what isn't
    // logger: console,
  },
})

// Disable on demand
client.config({stega: {enabled: false}})

// New client with different stega settings
const debugClient = client.withConfig({
  stega: {studioUrl: 'https://your-project-name.sanity.studio', logger: console},
})
```

Removing stega from part of the result, available on [`@sanity/client/stega`]:

```ts
import {stegaClean} from '@sanity/client/stega'
const result = await client.fetch('*[_type == "video"][0]')

// Remove stega from the payload sent to a third party library
const videoAsset = stegaClean(result.videoAsset)
```

#### Creating Studio edit intent links

If you want to create an edit link to something that isn't a string, or a field that isn't rendered directly, like a `slug` used in a URL but not rendered on the page, you can use the `resolveEditUrl` function.

```ts
import {createClient} from '@sanity/client'
import {resolveEditUrl} from '@sanity/client/csm'

const client = createClient({
  // ... standard client config
  // Required: the new 'withKeyArraySelector' option is used here instead of 'true' so that links to array items and portable text are stable even if the array is reordered
  resultSourceMap: 'withKeyArraySelector',
})
const {result, resultSourceMap} = await client.fetch(
  `*[_type == "author" && slug.current == $slug][0]{name, pictures}`,
  {slug: 'john-doe'},
  // Required, otherwise you can't access `resultSourceMap`
  {filterResponse: false},
)

// The `result` looks like this:
const result = {
  name: 'John Doe',
  pictures: [
    {
      _type: 'image',
      alt: 'A picture of exactly what you think someone named John Doe would look like',
      _key: 'cee5fbb69da2',
      asset: {
        _ref: 'image-a75b03fdd5b5fa36947bf2b776a542e0c940f682-1000x1500-jpg',
        _type: 'reference',
      },
    },
  ],
}

const studioUrl = 'https://your-project-name.sanity.studio'

resolveEditUrl({
  // The URL resolver requires the base URL of your Sanity Studio instance
  studioUrl,
  // It also requires a Content Source Map for the query result you want to create an edit intent link for
  resultSourceMap,
  // The path to the field you want to edit. You can pass a string
  resultPath: 'pictures[0].alt',
  // or an array of segments
  resultPath: ['pictures', 0, 'alt'],
})
// ^? 'https://your-project-name.sanity.studio/intent/edit/mode=presentation;id=462efcc6-3c8b-47c6-8474-5544e1a4acde;type=author;path=pictures[_key=="cee5fbb69da2"].alt'
```

### Listening to queries

```js
const query = '*[_type == "comment" && authorId != $ownerId]'
const params = {ownerId: 'bikeOwnerUserId'}

const subscription = client.listen(query, params).subscribe((update) => {
  const comment = update.result
  console.log(`${comment.author} commented: ${comment.text}`)
})

// to unsubscribe later on
subscription.unsubscribe()
```

`client.listen(query, params = {}, options = {includeResult: true})`

Open a query that listens for updates on matched documents, using the given parameters (if any). The return value is an [RxJS Observable](https://rxjs.dev/guide/observable). When calling `.subscribe()` on the returned observable, a [subscription](https://rxjs.dev/api/index/class/Subscription) is returned, and this can be used to unsubscribe from the query later on by calling `subscription.unsubscribe()`

The update events which are emitted always contain `mutation`, which is an object containing the mutation which triggered the document to appear as part of the query.

By default, the emitted update event will also contain a `result` property, which contains the document with the mutation applied to it. In case of a delete mutation, this property will not be present, however. You can also tell the client not to return the document (to save bandwidth, or in cases where the mutation or the document ID is the only relevant factor) by setting the `includeResult` property to `false` in the options.

Likewise, you can also have the client return the document _before_ the mutation was applied, by setting `includePreviousRevision` to `true` in the options, which will include a `previous` property in each emitted object.

If it's not relevant to know what mutations that was applied, you can also set `includeMutation` to `false` in the options, which will save some additional bandwidth by omitting the `mutation` property from the received events.

### Fetch a single document

This will fetch a document from the [Doc endpoint](https://www.sanity.io/docs/http-doc). This endpoint cuts through any caching/indexing middleware that may involve delayed processing. As it is less scalable/performant than the other query mechanisms, it should be used sparingly. Performing a query is usually a better option.

```js
client.getDocument('bike-123').then((bike) => {
  console.log(`${bike.name} (${bike.seats} seats)`)
})
```

### Fetch multiple documents in one go

This will fetch multiple documents in one request from the [Doc endpoint](https://www.sanity.io/docs/http-doc). This endpoint cuts through any caching/indexing middleware that may involve delayed processing. As it is less scalable/performant than the other query mechanisms, it should be used sparingly. Performing a query is usually a better option.

```js
client.getDocuments(['bike123', 'bike345']).then(([bike123, bike345]) => {
  console.log(`Bike 123: ${bike123.name} (${bike123.seats} seats)`)
  console.log(`Bike 345: ${bike345.name} (${bike345.seats} seats)`)
})
```

Note: Unlike in the HTTP API, the order/position of documents is _preserved_ based on the original array of IDs. If any of the documents are missing, they will be replaced by a `null` entry in the returned array:

```js
const ids = ['bike123', 'nonexistent-document', 'bike345']
client.getDocuments(ids).then((docs) => {
  // the docs array will be:
  // [{_id: 'bike123', ...}, null, {_id: 'bike345', ...}]
})
```

### Listening to live content updates

> [!NOTE]
>
> Live Content is experimental and requires your client config to be set up with `apiVersion: 'vX'`.

```ts
// Subscribe to live updates
const subscription = client.live.events().subscribe((event) => {
  // Check if incoming tags match saved sync tags
  if (event.type === 'message' && event.tags.some((tag) => syncTags.includes(tag))) {
    // Refetch with ID to get latest data
    render(event.id)
  }
  if (event.type === 'restart') {
    // A restart event is sent when the `lastLiveEventId` we've been given earlier is no longer usable
    render()
  }
})
// Later, unsubscribe when no longer needed (such as on unmount)
// subscription.unsubscribe()
```

`client.live.events(options)`

Listen to live content updates. Returns an RxJS Observable. When calling `.subscribe()` on the returned observable, a subscription is returned, which can be used to unsubscribe from the events later on by calling `subscription.unsubscribe()`.

The `options` object can contain the following properties:

- `includeDrafts (boolean)` - Whether to include draft documents in the events. Default is false. Note: This is an experimental API and may change or be removed.
- `tag (string)` - Optional request tag for the listener. Use to identify the request in logs.

The method will emit different types of events:

- `message`: Regular event messages.
- `restart`: Emitted when the event stream restarts.
- `reconnect`: Emitted when the client reconnects to the event stream.
- `goaway`: Emitted when when the connection is rejected or had to be closed, eg. if connection limits are reached and the client should switch data fetching strategy from live to polling.
- `welcome`: Emitted when the client successfully connects to the event stream.

To listen to updates in draft content, set `includeDrafts` to `true`
and configure the client with a token or `withCredentials: true`. The token should have the lowest possible access role.

### Creating documents

```js
const doc = {
  _type: 'bike',
  name: 'Sanity Tandem Extraordinaire',
  seats: 2,
}

client.create(doc).then((res) => {
  console.log(`Bike was created, document ID is ${res._id}`)
})
```

`client.create(doc)`
`client.create(doc, mutationOptions)`

Create a document. Argument is a plain JS object representing the document. It must contain a `_type` attribute. It _may_ contain an `_id`. If an ID is not specified, it will automatically be created.

To create a draft document, prefix the document ID with `drafts.` - eg `_id: 'drafts.myDocumentId'`. To auto-generate a draft document ID, set `_id` to `drafts.` (nothing after the `.`).

### Creating/replacing documents

```js
const doc = {
  _id: 'my-bike',
  _type: 'bike',
  name: 'Sanity Tandem Extraordinaire',
  seats: 2,
}

client.createOrReplace(doc).then((res) => {
  console.log(`Bike was created, document ID is ${res._id}`)
})
```

`client.createOrReplace(doc)`
`client.createOrReplace(doc, mutationOptions)`

If you are not sure whether or not a document exists but want to overwrite it if it does, you can use the `createOrReplace()` method. When using this method, the document must contain an `_id` attribute.

### Creating if not already present

```js
const doc = {
  _id: 'my-bike',
  _type: 'bike',
  name: 'Sanity Tandem Extraordinaire',
  seats: 2,
}

client.createIfNotExists(doc).then((res) => {
  console.log('Bike was created (or was already present)')
})
```

`client.createIfNotExists(doc)`
`client.createIfNotExists(doc, mutationOptions)`

If you want to create a document if it does not already exist, but fall back without error if it does, you can use the `createIfNotExists()` method. When using this method, the document must contain an `_id` attribute.

### Patch/update a document

```js
client
  .patch('bike-123') // Document ID to patch
  .set({inStock: false}) // Shallow merge
  .inc({numSold: 1}) // Increment field by count
  .commit() // Perform the patch and return a promise
  .then((updatedBike) => {
    console.log('Hurray, the bike is updated! New document:')
    console.log(updatedBike)
  })
  .catch((err) => {
    console.error('Oh no, the update failed: ', err.message)
  })
```

Modify a document. `patch` takes a document ID. `set` merges the partialDoc with the stored document. `inc` increments the given field with the given numeric value. `commit` executes the given `patch`. Returns the updated object.

```
client.patch()
  [operations]
  .commit(mutationOptions)
```

### Setting a field only if not already present

```js
client.patch('bike-123').setIfMissing({title: 'Untitled bike'}).commit()
```

### Removing/unsetting fields

```js
client.patch('bike-123').unset(['title', 'price']).commit()
```

### Incrementing/decrementing numbers

```js
client
  .patch('bike-123')
  .inc({price: 88, numSales: 1}) // Increment `price` by 88, `numSales` by 1
  .dec({inStock: 1}) // Decrement `inStock` by 1
  .commit()
```

### Patch a document only if revision matches

You can use the `ifRevisionId(rev)` method to specify that you only want the patch to be applied if the stored document matches a given revision.

```js
client
  .patch('bike-123')
  .ifRevisionId('previously-known-revision')
  .set({title: 'Little Red Tricycle'})
  .commit()
```

### Adding elements to an array

The patch operation `insert` takes a location (`before`, `after` or `replace`), a path selector and an array of elements to insert.

```js
client
  .patch('bike-123')
  // Ensure that the `reviews` arrays exists before attempting to add items to it
  .setIfMissing({reviews: []})
  // Add the items after the last item in the array (append)
  .insert('after', 'reviews[-1]', [{title: 'Great bike!', stars: 5}])
  .commit({
    // Adds a `_key` attribute to array items, unique within the array, to
    // ensure it can be addressed uniquely in a real-time collaboration context
    autoGenerateArrayKeys: true,
  })
```

### Appending/prepending elements to an array

The operations of appending and prepending to an array are so common that they have been given their own methods for better readability:

```js
client
  .patch('bike-123')
  .setIfMissing({reviews: []})
  .append('reviews', [{title: 'Great bike!', stars: 5}])
  .commit({autoGenerateArrayKeys: true})
```

### Deleting an element from an array

Each entry in the `unset` array can be either an attribute or a JSON path.

In this example, we remove the first review and the review with `_key: 'abc123'` from the `bike.reviews` array:

```js
const reviewsToRemove = ['reviews[0]', 'reviews[_key=="abc123"]']
client.patch('bike-123').unset(reviewsToRemove).commit()
```

### Delete documents

A single document can be deleted by specifying a document ID:

`client.delete(docId)`
`client.delete(docId, mutationOptions)`

```js
client
  .delete('bike-123')
  .then(() => {
    console.log('Bike deleted')
  })
  .catch((err) => {
    console.error('Delete failed: ', err.message)
  })
```

One or more documents can be deleted by specifying a GROQ query (and optionally, `params`):

`client.delete({ query: "GROQ query", params: { key: value } })`

```js
// Without params
client
  .delete({query: '*[_type == "bike"][0]'})
  .then(() => {
    console.log('The document matching *[_type == "bike"][0] was deleted')
  })
  .catch((err) => {
    console.error('Delete failed: ', err.message)
  })
```

```js
// With params
client
  .delete({query: '*[_type == $type][0..1]', params: {type: 'bike'}})
  .then(() => {
    console.log('The documents matching *[_type == "bike"][0..1] was deleted')
  })
  .catch((err) => {
    console.error('Delete failed: ', err.message)
  })
```

### Multiple mutations in a transaction

```js
const namePatch = client.patch('bike-310').set({name: 'A Bike To Go'})

client
  .transaction()
  .create({name: 'Sanity Tandem Extraordinaire', seats: 2})
  .delete('bike-123')
  .patch(namePatch)
  .commit()
  .then((res) => {
    console.log('Whole lot of stuff just happened')
  })
  .catch((err) => {
    console.error('Transaction failed: ', err.message)
  })
```

`client.transaction().create(doc).delete(docId).patch(patch).commit()`

Create a transaction to perform chained mutations.

```js
client
  .transaction()
  .create({name: 'Sanity Tandem Extraordinaire', seats: 2})
  .patch('bike-123', (p) => p.set({inStock: false}))
  .commit()
  .then((res) => {
    console.log('Bike created and a different bike is updated')
  })
  .catch((err) => {
    console.error('Transaction failed: ', err.message)
  })
```

`client.transaction().create(doc).patch(docId, p => p.set(partialDoc)).commit()`

A `patch` can be performed inline on a `transaction`.

### Clientless patches & transactions

Transactions and patches can also be built outside the scope of a client:

```js
import {createClient, Patch, Transaction} from '@sanity/client'
const client = createClient({
  projectId: 'your-project-id',
  dataset: 'bikeshop',
})

// Patches:
const patch = new Patch('<documentId>')
client.mutate(patch.inc({count: 1}).unset(['visits']))

// Transactions:
const transaction = new Transaction().create({_id: '123', name: 'FooBike'}).delete('someDocId')

client.mutate(transaction)
```

`const patch = new Patch(docId)`

`const transaction = new Transaction()`

An important note on this approach is that you cannot call `commit()` on transactions or patches instantiated this way, instead you have to pass them to `client.mutate()`

### Release and version operations

Release and version actions can be taken directly using the client's [actions API](#version-actions). Additionally, helper methods are provided which abstract some esoteric nomenclature with the release and version processing.

0. Setup the client

```js
import {createClient} from '@sanity/client'

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'bikeshop',
})
```

1. Create a new release

```js
const {releaseId} = await client.releases.create({
  metadata: {
    title: 'New bike drop'
    releaseType: 'scheduled'
  }
})
```

2. Create a new document into the release

```js
client.createVersion({
  document: {
    _type: 'bike',
    name: 'Upgraded black bike',
  },
  releaseId,
  publishedId: 'bike-123',
})
```

3. Mark a document to be unpublished when the release is run

```js
client.unpublishVersion({
  publishedId: 'old-red-bike',
  releaseId,
})
```

4. List the release and all the documents within the release

```js
const newBikesRelease = await client.releases.get({releaseId})
/**
 * {
 *   _type: 'system.release',
 *   _id: '_.releases.releaseId',
 *   name: 'releaseId',
 *   state: 'active',
 *   metadata: {
 *     name: 'New bike drop',
 *     releaseType: 'scheduled'
 *   }
 * }
 */

const releaseDocuments = await client.releases.getDocuments({
  releaseId,
})

/**
 * Returns a list of documents eg.
 *
 * [{
 *   _type: 'bike',
 *   _id: 'versions.releaseId.bike-123',
 *   name: 'Upgraded black bike',
 *   ...
 * },
 * {
 *   _type: 'bike',
 *   _id: 'versions.releaseId.old-red-bike',
 *   _system: {
 *     delete: true
 * }
 * }]
 */
```

5. Schedule the release (to run in 1 hours time)

```js
client.release.schedule({
  releaseId,
  publishAt: new Date(Date.now() + 3600000).toISOString(),
})
```

6. After the release has run, check and delete the release

```js
const runRelease = await client.releases.get({releaseId})

if (runRelease.state === 'published' && !runRelease.error) {
  client.releases.delete({releaseId})
}
```

### Actions

The Actions API provides a new interface for creating, updating and publishing documents. It is a wrapper around the [Actions API](https://www.sanity.io/docs/http-actions).

This API is only available from API version `v2024-05-23`.

#### Action options

The following options are available for actions, and can be applied as the second argument to `action()`.

- `transactionId`: If set, this ID is as transaction ID for the action instead of using an autogenerated one.
- `dryRun` (`true|false`) - default `false`. If true, the mutation will be a dry run - the response will be identical to the one returned had this property been omitted or false (including error responses) but no documents will be affected.
- `skipCrossDatasetReferenceValidation` (`true|false`) - default `false`. If true, the mutation will be skipped validation of cross dataset references. This is useful when you are creating a document that references a document in a different dataset, and you want to skip the validation to avoid an error.

#### Create Action

A document draft can be created by specifying a create action type:

```js
client
  .action(
    {
      actionType: 'sanity.action.document.create',
      publishedId: 'bike-123',
      attributes: {name: 'Sanity Tandem Extraordinaire', _type: 'bike', seats: 1},
      ifExists: 'fail',
    },
    actionOptions,
  )
  .then(() => {
    console.log('Bike draft created')
  })
  .catch((err) => {
    console.error('Create draft failed: ', err.message)
  })
```

#### Delete Action

A published document can be deleted by specifying a delete action type, optionally including some drafts:

```js
client
  .action(
    {
      actionType: 'sanity.action.document.delete',
      publishedId: 'bike-123',
      includeDrafts: ['draft.bike-123'],
    },
    actionOptions,
  )
  .then(() => {
    console.log('Bike deleted')
  })
  .catch((err) => {
    console.error('Delete failed: ', err.message)
  })
```

#### Edit Action

A patch can be applied to an existing document draft or create a new one by specifying an edit action type:

```js
client
  .action(
    {
      actionType: 'sanity.action.document.edit',
      publishedId: 'bike-123',
      attributes: {name: 'Sanity Tandem Extraordinaire', _type: 'bike', seats: 2},
    },
    actionOptions,
  )
  .then(() => {
    console.log('Bike draft edited')
  })
  .catch((err) => {
    console.error('Edit draft failed: ', err.message)
  })
```

#### Publish Action

A draft document can be published by specifying a publish action type, optionally with revision ID checks:

```js
client
  .action(
    {
      actionType: 'sanity.action.document.publish',
      draftId: 'draft.bike-123',
      ifDraftRevisionId: '<previously-known-revision>',
      publishedId: 'bike-123',
      ifPublishedRevisionId: '<previously-known-revision>',
    },
    actionOptions,
  )
  .then(() => {
    console.log('Bike draft published')
  })
  .catch((err) => {
    console.error('Publish draft failed: ', err.message)
  })
```

#### Unpublish Action

A published document can be retracted by specifying an unpublish action type:

```js
client
  .action(
    {
      actionType: 'sanity.action.document.unpublish',
      draftId: 'draft.bike-123',
      publishedId: 'bike-123',
    },
    actionOptions,
  )
  .then(() => {
    console.log('Bike draft unpublished')
  })
  .catch((err) => {
    console.error('Unpublish draft failed: ', err.message)
  })
```

## Version actions

### Create version

Create a draft or release version of a published document.

```js
client.action(
  {
    actionType: 'sanity.action.document.version.create',
    publishedId: 'bike-123',
    document: {
      _id: 'versions.new-bike-release.bike-123'
      _type: 'bike'
    }
  }
).then(() => {
  console.log('Copy of published `bike-123` created in release `new-bike-release`')
}).catch((err) => {
  console.error('Create version failed: ', err.message)
})
```

> [!NOTE]
> Replacing `versions.<releaseId>` with `drafts` will create a new draft version from the published document.

### Discard version

Discard a draft or release version.

```js
client
  .action({
    actionType: 'sanity.action.document.version.discard',
    versionId: 'versions.new-bike-release.bike-123',
  })
  .then(() => {
    console.log('Discarded the version of `bike-123` within the `new-bike-release` release')
  })
  .catch((err) => {
    console.error('Discard version failed: ', err.message)
  })
```

### Replace version

Replaces the contents of an existing draft or release version document.

```js
client
  .action({
    actionType: 'sanity.action.document.version.replace',
    document: {
      _id: 'versions.new-bike-release.bike-123',
      color: 'red',
      _type: 'bike',
    },
  })
  .then(() => {
    console.log('Replaced the existing `bike-123` document within the `new-bike-release` release')
  })
  .catch((err) => {
    console.error('Replace version failed: ', err.message)
  })
```

### Unpublish version

Marks a document to be unpublished when the release it is part of is run.

```js
client
  .action({
    actionType: 'sanity.action.document.version.unpublish',
    publishedId: 'bike-123',
    versionId: 'versions.new-bike-release.bike-123',
  })
  .then(() => {
    console.log('`bike-123` will be unpublished when `new-bike-release` release is run')
  })
  .catch((err) => {
    console.error('Unpublish version failed: ', err.message)
  })
```

## Release Actions

### Create release

Create a new release.

```js
client
  .action({
    actionType: 'sanity.action.release.create',
    releaseId: 'new-bikes-release',
    metadata: {
      title: 'New bikes',
      releaseType: 'undecided',
    },
  })
  .then(() => {
    console.log('`new-bikes-release` created')
  })
  .catch((err) => {
    console.error('Create release failed: ', err.message)
  })
```

### Edit release

Edit the metadata on an existing release.

```js
client
  .action({
    actionType: 'sanity.action.release.edit',
    releaseId: 'new-bikes-release',
    patch: {
      set: {
        metadata: {
          releaseType: 'asap',
        },
      },
    },
  })
  .then(() => {
    console.log('`new-bikes-release` changed to `asap` release type')
  })
  .catch((err) => {
    console.error('Edit release failed: ', err.message)
  })
```

### Publish release

Publish all document versions within a release.

```js
client
  .action({
    actionType: 'sanity.action.release.publish',
    releaseId: 'new-bikes-release',
  })
  .then(() => {
    console.log('`new-bikes-release` published')
  })
  .catch((err) => {
    console.error('Publish release failed: ', err.message)
  })
```

### Schedule release

Schedule a release to be run now or in the future

```js
client
  .action({
    actionType: 'sanity.action.release.schedule',
    releaseId: 'new-bikes-release',
    publishAt: '2025-01-01T00:00:00.000Z',
  })
  .then(() => {
    console.log('`new-bikes-release` scheduled')
  })
  .catch((err) => {
    console.error('Schedule release failed: ', err.message)
  })
```

### Unschedule release

Unschedule a currently scheduled release, to stop the release being run.

```js
client
  .action({
    actionType: 'sanity.action.release.unschedule',
    releaseId: 'new-bikes-release',
  })
  .then(() => {
    console.log('`new-bikes-release` unscheduled')
  })
  .catch((err) => {
    console.error('Unschedule release failed: ', err.message)
  })
```

### Archive release

Mark an active (not published) release as archived.

```js
client
  .action({
    actionType: 'sanity.action.release.archive',
    releaseId: 'new-bikes-release',
  })
  .then(() => {
    console.log('`new-bikes-release` archived')
  })
  .catch((err) => {
    console.error('Archive release failed: ', err.message)
  })
```

### Unarchive release

Once a release has been archived, the archive process may be undone by unarchiving the release.

```js
client
  .action({
    actionType: 'sanity.action.release.unarchive',
    releaseId: 'new-bikes-release',
  })
  .then(() => {
    console.log('`new-bikes-release` unarchived')
  })
  .catch((err) => {
    console.error('Unarchive release failed: ', err.message)
  })
```

### Delete release

An archived release can be deleted, which will remove the system release document permanently from the dataset.

```js
client
  .action({
    actionType: 'sanity.action.release.delete',
    releaseId: 'new-bikes-release',
  })
  .then(() => {
    console.log('`new-bikes-release` deleted')
  })
  .catch((err) => {
    console.error('Delete release failed: ', err.message)
  })
```

### Uploading assets

Assets can be uploaded using the `client.assets.upload(...)` method.

```
client.assets.upload(type: 'file' | image', body: File | Blob | Buffer | NodeJS.ReadableStream, options = {}): Promise<AssetDocument>
```

👉 Read more about [assets in Sanity](https://sanity.io/docs/assets)

#### Examples: Uploading assets from Node.js

```js
// Upload a file from the file system
client.assets
  .upload('file', fs.createReadStream('myFile.txt'), {filename: 'myFile.txt'})
  .then((document) => {
    console.log('The file was uploaded!', document)
  })
  .catch((error) => {
    console.error('Upload failed:', error.message)
  })
```

```js
// Upload an image file from the file system
client.assets
  .upload('image', fs.createReadStream('myImage.jpg'), {filename: 'myImage.jpg'})
  .then((document) => {
    console.log('The image was uploaded!', document)
  })
  .catch((error) => {
    console.error('Upload failed:', error.message)
  })
```

#### Examples: Uploading assets from the Browser

```js
// Create a file with "foo" as its content
const file = new File(['foo'], 'foo.txt', {type: 'text/plain'})
// Upload it
client.assets
  .upload('file', file)
  .then((document) => {
    console.log('The file was uploaded!', document)
  })
  .catch((error) => {
    console.error('Upload failed:', error.message)
  })
```

```js
// Draw something on a canvas and upload as image
const canvas = document.getElementById('someCanvas')
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#f85040'
ctx.fillRect(0, 0, 50, 50)
ctx.fillStyle = '#fff'
ctx.font = '10px monospace'
ctx.fillText('Sanity', 8, 30)
canvas.toBlob(uploadImageBlob, 'image/png')

function uploadImageBlob(blob) {
  client.assets
    .upload('image', blob, {contentType: 'image/png', filename: 'someText.png'})
    .then((document) => {
      console.log('The image was uploaded!', document)
    })
    .catch((error) => {
      console.error('Upload failed:', error.message)
    })
}
```

#### Examples: Specify image metadata to extract

```js
// Extract palette of colors as well as GPS location from exif
client.assets
  .upload('image', someFile, {extract: ['palette', 'location']})
  .then((document) => {
    console.log('The file was uploaded!', document)
  })
  .catch((error) => {
    console.error('Upload failed:', error.message)
  })
```

### Deleting an asset

Deleting an asset document will also trigger deletion of the actual asset.

```
client.delete(assetDocumentId: string): Promise
```

```js
client.delete('image-abc123_someAssetId-500x500-png').then((result) => {
  console.log('deleted imageAsset', result)
})
```

### Mutation options

The following options are available for mutations, and can be applied either as the second argument to `create()`, `createOrReplace`, `createIfNotExists`, `delete()` and `mutate()` - or as an argument to the `commit()` method on patches and transactions.

- `visibility` (`'sync'|'async'|'deferred'`) - default `'sync'`
  - `sync`: request will not return until the requested changes are visible to subsequent queries.
  - `async`: request will return immediately when the changes have been committed, but it might still be a second or more until changes are reflected in a query. Unless you are immediately re-querying for something that includes the mutated data, this is the preferred choice.
  - `deferred`: fastest way to write - bypasses real-time indexing completely, and should be used in cases where you are bulk importing/mutating a large number of documents and don't need to see that data in a query for tens of seconds.
- `dryRun` (`true|false`) - default `false`. If true, the mutation will be a dry run - the response will be identical to the one returned had this property been omitted or false (including error responses) but no documents will be affected.
- `autoGenerateArrayKeys` (`true|false`) - default `false`. If true, the mutation API will automatically add `_key` attributes to objects in arrays that are missing them. This makes array operations more robust by having a unique key within the array available for selections, which helps prevent race conditions in real-time, collaborative editing.

### Aborting a request

Requests can be aborted (or cancelled) in two ways:

#### 1. Abort a request by passing an [AbortSignal] with the request options

Sanity Client supports the [AbortController] API and supports receiving an abort signal that can be used to cancel the request. Here's an example that will abort the request if it takes more than 200ms to complete:

```js
const abortController = new AbortController()

// note the lack of await here
const request = getClient().fetch('*[_type == "movie"]', {}, {signal: abortController.signal})

// this will abort the request after 200ms
setTimeout(() => abortController.abort(), 200)

try {
  const response = await request
  //…
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request was aborted')
  } else {
    // rethrow in case of other errors
    throw error
  }
}
```

#### 2. Cancel a request by unsubscribing from the Observable

When using the Observable API (e.g. `client.observable.fetch()`), you can cancel the request by simply `unsubscribe` from the returned observable:

```js
const subscription = client.observable.fetch('*[_type == "movie"]').subscribe((result) => {
  /* do something with the result */
})

// this will cancel the request
subscription.unsubscribe()
```

### Get client configuration

```js
const config = client.config()
console.log(config.dataset)
```

`client.config()`

Get client configuration.

### Set client configuration

```js
client.config({dataset: 'newDataset'})
```

`client.config(options)`

Set client configuration. Required options are `projectId` and `dataset`.

### Agent Actions API

The Agent Actions API provides programmatic access to AI-powered content generation, transformation, and translation for your Sanity documents. These APIs are available on the `client.agent.action` namespace.

> **Note:** These APIs are currently in beta and may change in future releases.

#### Overview

Agent Actions allow you to:

- **Generate** new content for a document or specific fields using LLM instructions.
- **Transform** a document based on instructions, optionally copying from a source document.
- **Translate** a document or fields from one language to another, with support for style guides and protected phrases.
- **Prompt** the LLM using the same instruction template format as the other actions, but returns text or json instead of acting on a document.
- **Patch** documents using a schema-aware API; validates that provided paths and values are schema compliant and handles `setIfMissing` semantics for deep value operations

All methods are available in both Promise and Observable forms:

- `client.agent.action.generate`, `client.agent.action.transform`, `client.agent.action.translate`, `client.agent.action.prompt`, `client.agent.action.patch` (Promise-based)
- `client.observable.agent.action.generate`, etc. (Observable-based, for streaming or RxJS use)

---

#### Generating Content

```ts
const result = await client.agent.action.generate({
  schemaId: 'your-schema-id',
  documentId: 'your-document-id',
  instruction: 'Write a summary for the following topic: $topic',
  instructionParams: {
    topic: 'Grapefruit',
  },
  target: {path: ['body']},
})
```

- **schemaId**: The schema identifier for the document type.
- **documentId**: The ID of the document to generate content for.
- **instruction**: A string template describing what to generate. Use `$variable` for dynamic values.
- **instructionParams**: Values for variables in the instruction. Supports constants, fields, documents, or GROQ queries.
- **target**: (Optional) Specifies which fields or paths to generate content for.
- **temperature**: (Optional) Controls variance, 0-1 – defaults to 0.3
- **async**: (Optional) when true, the request will respond with the document id; the LLM request and mutations will continue on the server.
- **noWrite**: (Optional) when true, the document will not be changed. The response will contain the document value with the changes.
- **conditionalPaths**: (Optional) control how conditionally readOnly and hidden fields and types will be treated

##### Generating images

Generate will generate images the same was as AI Assist, for images that have been configured using
[AI Assist schema options](https://github.com/sanity-io/assist/tree/main/plugin#image-generation).

To generate images _without_ changing the schema, directly target an image asset path.

For example, all the following will generate an image into the provided asset:

- `target: {path: ['image', 'asset'] }`
- `target: {path: 'image', include: ['asset'] }`

Image generation can be combined with regular content targets:

- `target: [{path: ['image', 'asset'] }, {include: ['title', 'description']}]`

Since Generate happens in a single LLM pass, the image will be contextually related to other generated content.

##### Example: Using GROQ in instructionParams

```ts
await client.agent.action.generate({
  schemaId,
  documentId,
  instruction: 'Generate a title based on these: $list',
  instructionParams: {
    list: {
      type: 'groq',
      query: '*[_type==$type].title',
      params: {type: 'article'},
      perspective: 'drafts', // optional
    },
  },
  target: {path: ['body']},
})
```

#### Example: Using the async flag

The `async` parameter allows you to fire and forget and will not wait for a response from the LLMj, this works also in the Transform and Translate APIs.

```ts
const result = await client.agent.action.generate({
  schemaId: 'article',
  documentId: 'article-123',
  instruction: 'Write a comprehensive article about $topic',
  instructionParams: {
    topic: 'Climate Change',
  },
  target: {path: ['body']},
  async: true, // Enable async mode for long-running tasks or where you don't want to wait for the result
})

// result will return back the document id
console.log('Generation task started:', result._id)
```

#### Transforming Documents

```ts
const result = await client.agent.action.transform({
  schemaId: 'your-schema-id',
  documentId: 'source-document-id',
  instruction: 'Transform the content to a more formal tone.',
  targetDocument: {operation: 'edit', _id: 'target-document-id'},
  target: {path: ['body']},
})
```

- **schemaId**: The schema identifier for the document type.
- **documentId**: The source document ID.
- **instruction**: A string template describing the transformation.
- **targetDocument**: (Optional) Specify a different document to write the result to, or create a new one.
- **target**: (Optional) Specifies which fields or paths to transform.
- **temperature**: (Optional) Controls variance, 0-1 – defaults to 0
- **async**: (Optional) when true, the request will respond with the document id; the LLM request and mutations will continue on the server.
- **noWrite**: (Optional) when true, the document will not be changed. The response will contain the document value with the changes.
- **conditionalPaths**: (Optional) control how conditionally readOnly and hidden fields and types will be treated

##### Transforming images

To transform an existing image, directly target an image asset path.

For example, all the following will transform the image into the provided asset:

- `target: {path: ['image', 'asset'] }`
- `target: {path: 'image', include: ['asset'] }`

Image transform can be combined with regular content targets:

- `target: [{path: ['image', 'asset'] }, {include: ['title', 'description']}]`

Image transform can have per-path instructions, just like any other target paths:

- `target: [{path: ['image', 'asset'], instruction: 'Make the sky blue' }`

##### Image descriptions

## Image description

Images can be transformed to a textual description by targeting a `string`, `text` or Portable Text field (`array` with `block`)
with `operation: {type: 'image-description'}`.

Custom instructions for image description targets will be used to generate the description.

###### Targeting image fields

If a target is a descendant field of an image object, no `sourcePath` is required in the operation:

For example:

- `target: {path: ['image', 'description'], operation: {type: 'image-description'} }`
- `target: {path: ['array', {_key: 'abc'}, 'alt'], operation: {type: 'image-description'} } //assuming the item in the array on the key-ed path is an image`
- `target: {path: ['image'], include: ['portableTextField'], operation: {type: 'image-description'}, instruction: 'Use formatting and headings to describe the image in great detail' }`

###### Targeting non-image fields

If the target image description lives outside an image object, use the `sourcePath` option to specify the path to the image field.
`sourcePath` must be an image or image asset field.

For example:

- `target: {path: ['description'], operation: {type: 'image-description', sourcePath: ['image', 'asset'] }`
- `target: {path: ['wrapper', 'title'], operation: {type: 'image-description', sourcePath: ['array', {_key: 'abc'}, 'image'] }`
- `target: {path: ['wrapper'], include: ['portableTextField'], operation: {type: 'image-description', sourcePath: ['image', 'asset'] }, instruction: 'Use formatting and headings to describe the image in great detail' }`

###### Targeting images outside the document (URL)

If the source image is available on a https URL outside the target document, it is possible to get a description for it using `imageUrl`.

Example:

- `target: {path: ['description'], operation: operation: {type: 'image-description', imageUrL: 'https://www.sanity.io/static/images/favicons/android-icon-192x192.png?v=2' }`

##### Example: Field-based transformation

```ts
await client.agent.action.transform({
  schemaId,
  documentId,
  instruction: 'Summarize the following field: $content',
  instructionParams: {
    content: {type: 'field', path: ['body']},
  },
  target: {path: ['body']},
})
```

---

#### Translating Documents

```ts
const result = await client.agent.action.translate({
  schemaId: 'your-schema-id',
  documentId: 'source-document-id',
  targetDocument: {operation: 'create'},
  fromLanguage: {id: 'en', title: 'English'},
  toLanguage: {id: 'es', title: 'Spanish'},
  styleGuide: 'Use a friendly tone.',
  protectedPhrases: ['Sanity', 'Grapefruit'],
  target: {path: ['body']},
})
```

- **schemaId**: The schema identifier for the document type.
- **documentId**: The source document ID.
- **targetDocument**: (Optional) Specify a different document to write the result to, or create a new one.
- **fromLanguage**: (Optional) The source language code and title.
- **toLanguage**: The target language code and title.
- **styleGuide**: (Optional) Instructions for translation style.
- **protectedPhrases**: (Optional) Array of phrases to leave untranslated.
- **target**: (Optional) Specifies which fields or paths to translate.
- **temperature**: (Optional) Controls variance, 0-1 – defaults to 0
- **async**: (Optional) when true, the request will respond with the document id; the LLM request and mutations will continue on the server.
- **noWrite**: (Optional) when true, the document will not be changed. The response will contain the document value with the changes.
- **conditionalPaths**: (Optional) control how conditionally readOnly and hidden fields and types will be treated

##### Example: Storing language in a field

```ts
await client.agent.action.translate({
  schemaId,
  documentId,
  toLanguage: {id: 'fr', title: 'French'},
  languageFieldPath: ['language'],
  target: {path: ['body']},
})
```

#### Prompt the LLM

```ts
const result = await client.agent.action.prompt({
  instruction: 'Say: Oh, hi $name!',
  instructionParams: {
    name: 'Mark',
  },
  temperature: 0.5,
  format: 'string',
})
```

- **instruction**: A string template describing what the LLM should do. Use `$variable` for dynamic values.
- **instructionParams**: Values for variables in the instruction. Supports constants, fields, documents, or GROQ queries.
- **format**: (Optional) 'string' or 'json'. Defaults to 'string'. Note that when specifying 'json', the instruction MUST include the word "json" (ignoring case) in some form.
- **temperature**: (Optional) Controls variance, 0-1 – defaults to 0

#### Patch with a schema-aware API

The `client.patch` and `client.transaction` API are not schema aware. This allows patching documents any way you want, but the operations will not fail if they deviate from the document schema.

To ensure schema-compliant operation, `client.agent.action.patch` is available. It will ensure that provided paths and values adhere to the document schema,
ensure no duplicate keys are inserted, and merge object values so `set` operations dont accidentally remove existing values.

```ts
const result = await client.agent.action.patch({
  schemaId,
  documentId,
  target: [
    {path: 'title', operation: 'set', value: 'New title'},
    {
      path: ['wrapper', 'array'],
      operation: 'append',
      value: [{_type: 'item', title: 'Item title'}],
    },
  ],
})
```

- **schemaId**: The schema identifier for the document type.
- **documentId**: The source document ID OR use `targetDocument`
- **targetDocument**: (Optional) Specify a different document to write the result to, or create a new one. Incompatible with `documentId`
- **target**: Specify patch operations and values for paths in the document.
- **async**: (Optional) when true, the request will respond with the document id; the LLM request and mutations will continue on the server.
- **noWrite**: (Optional) when true, the document will not be changed. The response will contain the document value with the changes.
- **conditionalPaths**: (Optional) control how conditionally readOnly and hidden fields and types will be treated

#### Appending into array after a key

When appending to arrays, providing a `_key` is optional.
When a path targets a key in an array, the values provided will be appended after that key'ed item in the array.
Note that when appending to arrays, `value` must be an array itself, even when only a single item should be appended.

```ts
const result = await client.agent.action.patch({
  schemaId,
  documentId,
  target: {
    path: ['array', {_key: 'existingKey'}],
    operation: 'append',
    value: [{_type: 'item', title: 'Item title', _key: 'isOptionalAndWillBeGeneratedIfMissing'}],
  },
})
```

### Media Library API

The Media Library provides centralized asset management for your organization. Store, organize, and manage digital assets across multiple applications and datasets.

When you configure the client with a Media Library resource, you can use familiar methods like `fetch()` and `assets.upload()` to work with your media library.

👉 Read more about [Media Library in Sanity](https://www.sanity.io/docs/media-library)

#### Configuration

```js
import {createClient} from '@sanity/client'

const client = createClient({
  token: 'valid-token',
  useCdn: false,
  resource: {
    type: 'media-library',
    id: 'your-media-library-id',
  },
})
```

#### Querying assets

Use `client.fetch()` to query assets in your Media Library using GROQ:

```js
// Query all assets
const assets = await client.fetch('*[_type == "sanity.asset"]')

// Query video assets
const videos = await client.fetch('*[assetType == "sanity.videoAsset"]')

// Query with filters
const recentAssets = await client.fetch('*[_type == "sanity.asset" && _createdAt > $date]', {
  date: '2025-01-01',
})
```

#### Uploading assets

Use `client.assets.upload()` to upload assets to your Media Library:

```js
import fs from 'node:fs'

// Upload an image
const imageAsset = await client.assets.upload('image', fs.createReadStream('photo.jpg'), {
  filename: 'photo.jpg',
  title: 'My Photo',
})

// Upload a video
const videoAsset = await client.assets.upload('file', fs.createReadStream('video.mp4'), {
  filename: 'video.mp4',
})
```

#### Deleting assets

Media Library uses the mutation API for deletions:

```js
// Delete a single asset
await client.delete('36fOGtOJOadpl4F9xpksb9uKjYp')

// Delete both the asset and its draft (recommended)
await client
  .transaction()
  .delete('36fOGtOJOadpl4F9xpksb9uKjYp')
  .delete('drafts.36fOGtOJOadpl4F9xpksb9uKjYp')
  .commit()
```

#### Getting video playback information

For video assets, use the specialized `getPlaybackInfo()` method to retrieve streaming URLs:

```js
// Basic usage with video asset ID
const playbackInfo = await client.mediaLibrary.video.getPlaybackInfo(
  'video-30rh9U3GDEK3ToiId1Zje4uvalC-mp4',
)

// With transformations
const playbackInfo = await client.mediaLibrary.video.getPlaybackInfo(
  'video-30rh9U3GDEK3ToiId1Zje4uvalC-mp4',
  {
    transformations: {
      thumbnail: {width: 300, format: 'webp', fit: 'smartcrop'},
      animated: {width: 200, fps: 15, format: 'webp'},
    },
    expiration: 3600, // seconds
  },
)

// Using Global Dataset Reference (GDR)
const playbackInfo = await client.mediaLibrary.video.getPlaybackInfo({
  _ref: 'media-library:mlZxz9rvqf76:30rh9U3GDEK3ToiId1Zje4uvalC',
})
```

The response contains playback URLs and metadata:

```js
// Public playback response
{
  id: "30rh9U3GDEK3ToiId1Zje4uvalC",
  stream: { url: "https://stream.m.sanity-cdn.com/..." },
  thumbnail: { url: "https://image.m.sanity-cdn.com/..." },
  animated: { url: "https://image.m.sanity-cdn.com/..." },
  storyboard: { url: "https://storyboard.m.sanity-cdn.com/..." },
  duration: 120.5,
  aspectRatio: 1.77
}

// Signed playback response (when video requires authentication)
{
  id: "30rh9U3GDEK3ToiId1Zje4uvalC",
  stream: {
    url: "https://stream.m.sanity-cdn.com/...",
    token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  thumbnail: {
    url: "https://image.m.sanity-cdn.com/...",
    token: "eyJ0a2VuIjoiVGh1bWJuYWlsVG9rZW4tMTIz..."
  },
  animated: {
    url: "https://image.m.sanity-cdn.com/...",
    token: "eyJ0a2VuIjoiQW5pbWF0ZWRUb2tlbi1kZWY..."
  },
  storyboard: {
    url: "https://storyboard.m.sanity-cdn.com/...",
    token: "eyJ0a2VuIjoiU3Rvcnlib2FyZFRva2VuLTc4..."
  },
  duration: 120.5,
  aspectRatio: 1.77
}
```

#### Working with signed playback information

```js
import {getPlaybackTokens, isSignedPlaybackInfo} from '@sanity/client/media-library'

const playbackInfo = await client.mediaLibrary.video.getPlaybackInfo(
  'video-30rh9U3GDEK3ToiId1Zje4uvalC-mp4',
)

// Check if the response requires signed URLs
if (isSignedPlaybackInfo(playbackInfo)) {
  // Extract tokens for use with video players
  const tokens = getPlaybackTokens(playbackInfo)
  console.log(tokens)
  // {
  //   stream: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  //   thumbnail: "eyJ0a2VuIjoiVGh1bWJuYWlsVG9rZW4tMTIz...",
  //   animated: "eyJ0a2VuIjoiQW5pbWF0ZWRUb2tlbi1kZWY...",
  //   storyboard: "eyJ0a2VuIjoiU3Rvcnlib2FyZFRva2VuLTc4..."
  // }

  // Use with Mux Player or other compatible players
  // The tokens authenticate access to the video resources
}
```

## License

MIT © [Sanity.io](https://www.sanity.io/)

# Migrate

## From `v5`

### The default `useCdn` is changed to `true`

It was previously `false`. If you were relying on the default being `false` you can continue using the live API by setting it in the constructor:

```diff
import {createClient} from '@sanity/client'

export const client = createClient({
  projectId: 'your-project-id',
  dataset: 'your-dataset-name',
  apiVersion: '2025-02-06',
+ useCdn: false, // set to `true` to use the edge cache
})
```

## From `v4`

### No longer shipping `ES5`

The target is changed to [modern browsers] that supports `ES6` `class`, `{...rest}` syntax and more. You may need to update your bundler to a recent major version. Or you could configure your bundler to transpile `@sanity/client`, and `get-it`, which is the engine that powers `@sanity/client` and uses the same output target.

### Node.js `v12` no longer supported

Upgrade to the [LTS release, or one of the Maintenance releases](https://github.com/nodejs/release#release-schedule).

### The `default` export is replaced with the named export `createClient`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()
```

```ts
import SanityClient from '@sanity/client'
const client = new SanityClient()
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()
```

### `client.assets.delete` is removed

Before:

```ts
client.assets.delete('image', 'abc123_foobar-123x123-png')
client.assets.delete('image', 'image-abc123_foobar-123x123-png')
client.assets.delete({_id: 'image-abc123_foobar-123x123-png'})
```

After:

```ts
client.delete('image-abc123_foobar-123x123-png')
```

### `client.assets.getImageUrl` is removed, replace with [`@sanity/image-url`](https://github.com/sanity-io/image-url)

Before:

```ts
import createClient from '@sanity/client'
const client = createClient({projectId: 'abc123', dataset: 'foo'})

client.assets.getImageUrl('image-abc123_foobar-123x123-png')
client.assets.getImageUrl('image-abc123_foobar-123x123-png', {auto: 'format'})
client.assets.getImageUrl({_ref: 'image-abc123_foobar-123x123-png'})
client.assets.getImageUrl({_ref: 'image-abc123_foobar-123x123-png'}, {auto: 'format'})
```

After:

```bash
npm install @sanity/image-url
```

```ts
import imageUrlBuilder from '@sanity/image-url'
const builder = imageUrlBuilder({projectId: 'abc123', dataset: 'foo'})
const urlFor = (source) => builder.image(source)

urlFor('image-abc123_foobar-123x123-png').url()
urlFor('image-abc123_foobar-123x123-png').auto('format').url()
urlFor({_ref: 'image-abc123_foobar-123x123-png'}).url()
urlFor({_ref: 'image-abc123_foobar-123x123-png'}).auto('format').url()
```

### `SanityClient` static properties moved to named exports

Before:

```ts
import SanityClient from '@sanity/client'

const {Patch, Transaction, ClientError, ServerError, requester} = SanityClient
```

After:

```ts
import {Patch, Transaction, ClientError, ServerError, requester} from '@sanity/client'
```

### `client.clientConfig` is removed, replace with `client.config()`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

console.log(client.clientConfig.projectId)
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()

console.log(client.config().projectId)
```

### `client.isPromiseAPI()` is removed, replace with an `instanceof` check

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

console.log(client.isPromiseAPI())
console.log(client.clientConfig.isPromiseAPI)
console.log(client.config().isPromiseAPI)
```

After:

```ts
import {createClient, SanityClient} from '@sanity/client'
const client = createClient()

console.log(client instanceof SanityClient)
```

### `client.observable.isObservableAPI()` is removed, replace with an `instanceof` check

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

console.log(client.observable.isObservableAPI())
```

After:

```ts
import {createClient, ObservableSanityClient} from '@sanity/client'
const client = createClient()

console.log(client.observable instanceof ObservableSanityClient)
```

### `client._requestObservable` is removed, replace with `client.observable.request`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

client._requestObservable({uri: '/ping'}).subscribe()
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()

client.observable.request({uri: '/ping'}).subscribe()
```

### `client._dataRequest` is removed, replace with `client.dataRequest`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

client._dataRequest(endpoint, body, options)
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()

client.dataRequest(endpoint, body, options)
```

### `client._create_` is removed, replace with one of `client.create`, `client.createIfNotExists` or `client.createOrReplace`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

client._create(doc, 'create', options)
client._create(doc, 'createIfNotExists', options)
client._create(doc, 'createOrReplace', options)
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()

client.create(doc, options)
client.createIfNotExists(doc, options)
client.createOrReplace(doc, options)
```

### `client.patch.replace` is removed, replace with `client.createOrReplace`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

client.patch('tropic-hab').replace({name: 'Tropical Habanero', ingredients: []}).commit()
```

After:

```ts
import {createClient} from '@sanity/client'
const client = createClient()

client.createOrReplace({
  _id: 'tropic-hab',
  _type: 'hotsauce',
  name: 'Tropical Habanero',
  ingredients: [],
})
```

### `client.auth` is removed, replace with `client.request`

Before:

```ts
import createClient from '@sanity/client'
const client = createClient()

/**
 * Fetch available login providers
 */
const loginProviders = await client.auth.getLoginProviders()
/**
 * Revoke the configured session/token
 */
await client.auth.logout()
```

After:

```ts
import {createclient, type AuthProviderResponse} from '@sanity/client'
const client = createClient()

/**
 * Fetch available login providers
 */
const loginProviders = await client.request<AuthProviderResponse>({uri: '/auth/providers'})
/**
 * Revoke the configured session/token
 */
await client.request<void>({uri: '/auth/logout', method: 'POST'})
```

[modern browsers]: https://browsersl.ist/#q=%3E+0.2%25+and+supports+es6-module+and+supports+es6-module-dynamic-import+and+not+dead+and+not+IE+11
[Deno]: https://deno.land/
[Edge Runtime]: https://edge-runtime.vercel.sh/
[Bun]: https://bun.sh/
[gzip-badge]: https://img.shields.io/bundlephobia/minzip/@sanity/client?label=gzip%20size&style=flat-square
[size-badge]: https://img.shields.io/bundlephobia/min/@sanity/client?label=size&style=flat-square
[unpkg-dist]: https://unpkg.com/@sanity/client/umd/
[bundlephobia]: https://bundlephobia.com/package/@sanity/client
[esm.sh]: https://esm.sh
[Node.js]: https://nodejs.org/en/
[Content Lake]: https://www.sanity.io/docs/datastore
[npm]: https://npmjs.com
[api-cdn]: https://www.sanity.io/docs/api-cdn
[CommonJS]: https://nodejs.org/api/modules.html#modules-commonjs-modules
[TypeScript]: https://www.typescriptlang.org/
[api-versioning]: http://sanity.io/docs/api-versioning
[zod]: https://zod.dev/
[groqd]: https://github.com/FormidableLabs/groqd#readme
[AbortSignal]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
[AbortController]: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
[visual-editing]: https://www.sanity.io/docs/vercel-visual-editing?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
[content-source-maps]: https://www.sanity.io/docs/content-source-maps?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
[content-source-maps-intro]: https://www.sanity.io/blog/content-source-maps-announce?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
[request-logs]: https://www.sanity.io/docs/request-logs?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
