# Resource-based Client

The resource-based client is a new variant of Sanity Client

- Focused on **Content Operations** where you want to modify content within the Sanity platform
  (as opposed to _Content Distribution_ where you're serving content to your customers).
- Works across different types of _resources_ (e.g. datasets, documents, users, media library).
- Excellent support for **typed queries**, including when you're running GROQ against different resources.
- Enables developers to write **generic libraries** that can work with different resources.
- **Tree shakable**: Functionality which is not used will not be part of the bundle.

In this document we'll go through various functionality and advanced patterns for the resource-based client:

1. The [**introduction**](#introduction) shows basic usage patterns and explains the core concepts.
1. [**Querying users**](#querying-users) demonstrates how this client enables us to query _any_ resource.
1. [**Typed queries**](#typed-queries) shows how we achieve full type safety with both single and multiple schema setups by leveraging Sanity TypeGen.
1. [**Composable queries**](#composable-querying) shows how we can build reusable, generic functions that work across any resource type.

## Introduction

```ts
import {dataset, mediaLibrary} from '@sanity/client'

// 1: Configuration is just a plain JavaScript object:
const config = {token: process.env.SANITY_TOKEN}

// 2: Declare your resource:
const content = dataset(process.env.PROJECT_ID, process.env.DATASET)
const media = mediaLibrary(process.env.MEDIA_LIBRARY_ID)

// 3: Run queries and actions:
await content.query('*[_type == "post"]|order(dateTime(publishedAt) desc)[0...10]', config)
await media.query('count(*[_type == "sanity.asset"])', config)

await content.action({…}, config)

// 4: Some resources have custom logic:
await media.upload(…, config)
```

1. Configuration in the resource-based client is a plain object.
   There's no "client" instance, but instead you need to pass around the configuration object.
2. `dataset` and `mediaLibrary` are _resource constructors_ which gives you a resource object.
   You're encouraged to define these once and then refer to them later.
3. The resources have common methods such as `query`, `action`, `get`.
   These are the same across different resources.
4. However, some resources can also have additional custom methods.

## Querying users

NOTE: This is an _aspirational_ section. This is currently not possible provided by our HTTP API, but we'd like to provide it in the future.

Your dataset is a resource that can be queried, but so are the other Sanity users.
Watch this:

```ts
import {users} from '@sanity/client'

// How many are named Ryan?
await users.query('count(*[name match "Ryan"])', config)
```

`users` is considered a resource, exactly in the same way that `dataset(projectId, dataset)` is a resource.

## Typed queries

### Single schema

The client itself doesn't provide automatic extraction of typed results, but Sanity TypeGen can generate types for you:

```ts
// src/data.ts
const content = dataset(process.env.PROJECT_ID, process.env.DATASET)

export const getPosts = () => content.query('*[_type == "post"]')
```

By running `sanity typegen generate` this will automatically detect

### Multiple schemas

Imagine that we have the following sources:

1. A single _product_ dataset which contains shared information about products.
2. Multiple _content_ datasets which contains the content for different brands.
3. We're also using the Media Library with custom aspects.

This is a bit more complicated now since the result of a GROQ query is dependent on where you're querying it from.

Every resource in the client has an attached _results type_ and by defining our own we can control.

```ts
// sources.ts
import {type DocumentSourceResults, dataset, mediaLibrary} from '@sanity/client'

// Product data:
export interface ProductResults extends DocumentSourceResults {}

export const product = dataset<ProductResults>(process.env.PROJECT_ID, process.env.PRODUCT_DATASET)

// Content data:
export interface ContentResults extends DocumentSourceResults {}

export function content(name: string) {
  return dataset<ContentResults>(process.env.PROJECT_ID, name)
}

// Media Library:
export interface MediaLibraryResults extends DocumentSourceResults {}

export const media = mediaLibrary<MediaLibraryResults>(process.env.MEDIA_LIBRARY_ID)
```

Now that we've set these up we can start querying:

```ts
import {media, products, content} from './sources'

await products.query('*[_type == "product" && sku == $sku]', {params: {sku: '…'}, ...config})
await media.query('*[_type == "sanity.asset"]', config)
await content('brand1').query('*[_type == "post"]', config)
```

The only thing left to do is to tell Sanity TypeGen where the schemas are located, and then all of your queries will have typed results:

```js
// sanity-typegen.json
{
  "schemas": [
    { "path": "./src/sources.ts", "interface": "ProductResults", "schema": "schema-products.json" },
    { "path": "./src/sources.ts", "interface": "ContentResults", "schema": "schema-content.json" },
    { "path": "./src/sources.ts", "interface": "MediaLibraryResults", "schema": "schema-media-library.json" }
  ]
}
```

## Composable querying

Up until now we've used the `query` method on a source, but the client also provides a top-level function `query` which accepts a source as the first parameter:

```ts
import {dataset, query} from '@sanity/client'

const content = dataset(process.env.PROJECT_ID, process.env.DATASET)

// These two are equivalent:
await content.query('*[_type == "post"]|order(dateTime(publishedAt) desc)[0...10]', config)
await query(content, '*[_type == "post"]|order(dateTime(publishedAt) desc)[0...10]', config)
```

The top-level functions are super useful for building functionality which can be re-used across different types of data.

For instance, let's say that:

- We want a function `countDocOfType` which counts the number of numbers of a given type.
- We want this function to work with _any_ resource.
- We also want the `type` parameter to be type-checked: It should only accept a known type.

```ts
import {
  query,
  type PlainConfig,
  type DocumentSource,
  type DocumentSourceResults,
  type DocFromResults,
} from '@sanity/client'

async function countDocOfType<Results extends DocumentSourceResults>(
  source: DocumentSource<Results>,
  type: DocFromResults<Results>['_type'],
  config: PlainConfig,
): Promise<number> {
  return await query(source, `count(*[_type == $type])`, {params: {type}, ...config})
}
```

And this now works on _any_ resource:

```ts
await countDocOfType(dataset(projectId, dataset), 'post', config)
await countDocOfType(mediaLibrary(id), 'post', config)
await countDocOfType(users, 'user', config)
```
