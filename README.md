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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
  // token: process.env.SANITY_SECRET_TOKEN // Only if you want to update content with the client
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
    - [Bun](#bun)
    - [Deno](#deno)
    - [Edge Runtime](#edge-runtime)
    - [Browser ESM CDN](#browser-esm-cdn)
    - [UMD](#umd)
  - [Specifying API version](#specifying-api-version)
  - [Performing queries](#performing-queries)
  - [Fetching Content Source Maps](#fetching-content-source-maps)
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
  - [Uploading assets](#uploading-assets)
    - [Examples: Uploading assets from Node.js](#examples-uploading-assets-from-nodejs)
    - [Examples: Uploading assets from the Browser](#examples-uploading-assets-from-the-browser)
    - [Examples: Specify image metadata to extract](#examples-specify-image-metadata-to-extract)
  - [Deleting an asset](#deleting-an-asset)
  - [Mutation options](#mutation-options)
  - [Aborting a request](#aborting-a-request)
  - [Get client configuration](#get-client-configuration)
  - [Set client configuration](#set-client-configuration)
- [Release new version](#release-new-version)
- [License](#license)
- [Migrate](#migrate)
  - [From `v5`](#from-v5)
  - [From `v4`](#from-v4)

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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
})

const schema = z.number()
const data = schema.parse(await client.fetch(`count(*)`))
// data is guaranteed to be `number`, or zod will throw an error
console.log(`Number of documents: ${data}`)
```

Another alternative is [groqd].

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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
    apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
    apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
  apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
    apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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
      apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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

### Fetching Content Source Maps

Content Source Maps annotate fragments in your query results with metadata about its origin: the field, document, and dataset it originated from.

> **Note**
>
> [Content Source Maps][content-source-maps-intro] are available [as an API][content-source-maps] for select [Sanity enterprise customers][enterprise-cta]. [Contact our sales team for more information.][sales-cta]

A high level API using Content Source Maps for [Visual editing][visual-editing] is also available in [`@sanity/preview-kit/client`][preview-kit-client]. It offers both a turn-key solution and a flexible API for custom experiences.

Read the [Content Source Maps introduction][content-source-maps-intro] before diving in, and keep the [Content Source Maps reference][content-source-maps] handy.

Enabling Content Source Maps is a two-step process:

1. Update your client configuration with `resultSourceMap`.

   ```js
   import {createClient} from '@sanity/client'

   const client = createClient({
     projectId: 'your-project-id',
     dataset: 'your-dataset-name',
     useCdn: true, // set to `false` to bypass the edge cache
     apiVersion: '2023-05-03', // use current date (YYYY-MM-DD) to target the latest API version
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

Once enabled, the `resultSourceMap` property will always exist on the response, given your `apiVersion` is recent enough. If there is no source map, it will be an empty object. There's also a TypeScript definition for it:

```ts
import type {ContentSourceMapping} from '@sanity/client'

const {result, resultSourceMap} = await client.fetch(query, params, {filterResponse: false})

function useContentSourceMap(resultSourceMap: ContentSourceMapping): unknown {
  // Sky's the limit
}

useContentSourceMap(resultSourceMap)
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

The following options are available for mutations, and can be applied either as the second argument to `create()`, `createOrReplace`, `createIfNotExist`, `delete()` and `mutate()` - or as an argument to the `commit()` method on patches and transactions.

- `visibility` (`'sync'|'async'|'deferred'`) - default `'sync'`
  - `sync`: request will not return until the requested changes are visible to subsequent queries.
  - `async`: request will return immediately when the changes have been committed, but it might still be a second or more until changes are reflected in a query. Unless you are immediately re-querying for something that includes the mutated data, this is the preferred choice.
  - `deferred`: fastest way to write - bypasses real-time indexing completely, and should be used in cases where you are bulk importing/mutating a large number of documents and don't need to see that data in a query for tens of seconds.
- `dryRun` (`true|false`) - default `false`. If true, the mutation will be a dry run - the response will be identical to the one returned had this property been omitted or false (including error responses) but no documents will be affected.
- `autoGenerateArrayKeys` (`true|false`) - default `false`. If true, the mutation API will automatically add `_key` attributes to objects in arrays that is missing them. This makes array operations more robust by having a unique key within the array available for selections, which helps prevent race conditions in real-time, collaborative editing.

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

## Release new version

Run ["CI & Release" workflow](https://github.com/sanity-io/client/actions/workflows/ci.yml).
Make sure to select the main branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.

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
  apiVersion: '2023-03-12',
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
[preview-kit-client]: https://github.com/sanity-io/preview-kit#sanitypreview-kitclient
[sales-cta]: https://www.sanity.io/contact/sales?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
[enterprise-cta]: https://www.sanity.io/enterprise?utm_source=github.com&utm_medium=referral&utm_campaign=may-vercel-launch
