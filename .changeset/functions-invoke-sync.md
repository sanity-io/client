---
'@sanity/client': minor
---

feat: invoke functions synchronously or asynchronously

`client.functions.invoke()` now takes an `options` argument and accepts `sanity.function.durable`
and `sanity.function.queue` functions alongside `sanity.function.pubsub`.

By default the invocation is queued: the call resolves with `undefined` as soon as the Functions
service accepts it, without waiting for the function to run. Pass `{sync: true}` to keep the
request open until the function finishes and resolve with its return value — that adds a
`?sync=true` query parameter to the invoke request, and remains limited to
`sanity.function.pubsub`.

```ts
// Queued — resolves once accepted, with no return value.
await client.functions.invoke('my-func', {event: {data: {hello: 'world'}}})

// Inline — resolves with whatever the function returns.
const result = await client.functions.invoke<Result>(
  'my-func',
  {event: {data: {hello: 'world'}}},
  {sync: true},
)
```

The return type follows the option: a call with `{sync: true}` resolves with `R`, while an async
call resolves with `undefined`. Callers who pass an explicit type argument without `{sync: true}`
keep the previous `R | undefined` shape.
