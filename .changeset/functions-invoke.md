---
'@sanity/client': minor
---

feat: add `client.functions.invoke()` for calling deployed functions on demand

Invoke a Sanity Pubsub Function by the `name`. Only `sanity.function.pubsub` functions can be
invoked on demand.

Available in two forms, `client.functions.invoke()` resolves with the function's return value, `client.observable.functions.invoke()` emits it and accepts an `event.data` payload,
a per-call `timeout` and an `AbortSignal`.

Names are only unique within a stack, so resolving one requires a `stackId`, either from the new
`stackId` client config option or from the request. That resolution costs one extra request per
call. A function that returns nothing resolves to `undefined`.

Stacks deployed at organization scope are reached with the new `organizationId` client config
option, or a per-call `organizationId`. It takes precedence over `projectId`, which becomes
optional in that case.
