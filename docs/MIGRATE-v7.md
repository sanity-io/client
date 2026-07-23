# Migrating from `v7`

## Node 22.12+ required, the package is now ESM-only

The minimum Node version is `22.12`. Node 20 went out of LTS in
April 2026 and is no longer supported.

The package ships as ESM only — the `require` conditions in `exports`, the
`./dist/*.cjs` files, and the CJS `main` entry are gone. The Node version
bump makes this a soft change: Node 22.12+ supports `require(esm)`
natively, so existing CJS code like

```ts
const {createClient} = require('@sanity/client')
```

continues to work without any change. ESM `import` is still preferred.

If you can't move off an older Node version, stay on `v7`.

## `HttpRequestEvent`, `ResponseEvent`, and `ProgressEvent` are removed

These types used to leak transport-level events into the public surface. The
only API that actually needed multi-event streams was
`client.assets.upload()` (observable variant), which now has its own
dedicated event types: `UploadEvent<T>`, `UploadResponseEvent<T>`,
`UploadProgressEvent`.

The `type` discriminants (`'response'`/`'progress'`) and progress event
shape (`stage`, `percent`, `total`, `loaded`, `lengthComputable`) are
unchanged. The response event drops the transport-level fields
(`statusCode`, `statusMessage`, `headers`, `url`, `method`) — if you need
those, use `client.request()` directly.

Before:

```ts
client.observable.assets.upload('image', file).pipe(
  filter(
    (event): event is ResponseEvent<{document: SanityImageAssetDocument}> =>
      event.type === 'response',
  ),
  map((event) => event.body.document),
)
```

After:

```ts
client.observable.assets.upload('image', file).pipe(
  filter(
    (event): event is UploadResponseEvent<{document: SanityImageAssetDocument}> =>
      event.type === 'response',
  ),
  map((event) => event.body.document),
)
```

## Upload progress events only fire in browsers now

`client.assets.upload()` runs through `XMLHttpRequest` when called in a
browser, so per-chunk progress events still surface there. fetch (and
therefore Node/edge runtimes) has no equivalent hook, so observable uploads
outside the browser only emit the terminal `response` event.

The Promise-based `client.assets.upload()` is unchanged and never emitted
progress events on either runtime.

## `unstable__adapter` and `unstable__environment` are removed

These exposed internal transport identifiers that no longer exist. They
were already `@alpha`. Drop the imports.

## Error messages now include the HTTP status text

`ClientError`/`ServerError` messages used to read
`...resulted in HTTP 400 (body)` because the underlying nock fixtures left
`statusText` empty. Real fetch responses always carry a status text, so the
format is now `...resulted in HTTP 400 Bad Request (body)`. If you grep
error messages, update your patterns.

The structured fields on the error (`statusCode`, `responseBody`,
`response.statusMessage`, `response.headers`, etc.) are unchanged.

## The `_requestHandler` interceptor is removed

The `_requestHandler` client config option (and its `RequestHandler` type),
both `@internal` and `@deprecated`, have been removed. The promise-based
client surface (`client.fetch()`, `client.create()`, …) now talks to the
transport directly as a Promise, and only `client.observable.*` and the
real-time subscription APIs (`client.listen()`, `client.live.events()`) use
RxJS. There is no longer a single observable choke point to intercept.

If you relied on `_requestHandler` for cross-cutting concerns (logging,
injecting headers, token refresh, rate limiting), move that logic into a
`get-it` middleware, or wrap the client methods you call.

## The `uri` request option is removed — use `url`

Request options no longer accept the legacy `uri` alias. `client.request()`,
`client.observable.request()`, and the raw `requester` export all require
`url`, and a request without one throws
``TypeError: Request options must include a `url` ``.

Before:

```ts
client.request({uri: '/ping'})
```

After:

```ts
client.request({url: '/ping'})
```

`url` takes the same API-relative path `uri` did (an absolute URL for the raw
`requester` export), so this is a rename — no other change is needed. The
`uri` property is also gone from the `RawRequestOptions` and
`RequestObservableOptions` types.

## Proxying is configured per client, not per request

The `proxy` option can no longer be passed with individual request options.
Pass `proxy:` on the client config instead (Node.js only) — it can also be
replaced later via `client.config({proxy})` or `client.withConfig({proxy})`.
For environment-driven proxying, set `HTTP_PROXY` / `HTTPS_PROXY` /
`NO_PROXY` before the process starts. If different requests genuinely need
different proxies, derive a client per proxy with `withConfig` — clients are
cheap to instantiate.

## Mid-process `HTTPS_PROXY` changes no longer take effect

The HTTP transport now uses Node's built-in fetch, which reads the
`HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` env vars once when the proxy
dispatcher is constructed — not per request. Set proxy env vars before the
process starts, or pass `proxy:` on the client config.

## Retry now retries `ENOTFOUND`

Previously `ENOTFOUND` (DNS resolution failure) was considered fatal; it's
now treated as a transient network error on idempotent methods (`GET`,
`HEAD`) and retried with the standard exponential backoff. Pass
`maxRetries: 0` if you want the old "fail fast" behaviour.
