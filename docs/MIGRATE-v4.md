# Migrating from `v4`

## No longer shipping `ES5`

The target is changed to [modern browsers] that supports `ES6` `class`, `{...rest}` syntax and more. You may need to update your bundler to a recent major version. Or you could configure your bundler to transpile `@sanity/client`, and `get-it`, which is the engine that powers `@sanity/client` and uses the same output target.

## Node.js `v12` no longer supported

Upgrade to the [LTS release, or one of the Maintenance releases](https://github.com/nodejs/release#release-schedule).

## The `default` export is replaced with the named export `createClient`

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

## `client.assets.delete` is removed

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

## `client.assets.getImageUrl` is removed, replace with [`@sanity/image-url`](https://github.com/sanity-io/image-url)

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

## `SanityClient` static properties moved to named exports

Before:

```ts
import SanityClient from '@sanity/client'

const {Patch, Transaction, ClientError, ServerError, requester} = SanityClient
```

After:

```ts
import {Patch, Transaction, ClientError, ServerError, requester} from '@sanity/client'
```

## `client.clientConfig` is removed, replace with `client.config()`

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

## `client.isPromiseAPI()` is removed, replace with an `instanceof` check

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

## `client.observable.isObservableAPI()` is removed, replace with an `instanceof` check

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

## `client._requestObservable` is removed, replace with `client.observable.request`

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

## `client._dataRequest` is removed, replace with `client.dataRequest`

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

## `client._create_` is removed, replace with one of `client.create`, `client.createIfNotExists` or `client.createOrReplace`

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

## `client.patch.replace` is removed, replace with `client.createOrReplace`

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

## `client.auth` is removed, replace with `client.request`

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
