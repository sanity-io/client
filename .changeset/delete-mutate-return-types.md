---
'@sanity/client': patch
---

fix: correct the return type of `delete()` and `mutate()` when called with no options

`client.delete(id)` and `client.mutate(mutations)` were typed to resolve to a
document (`SanityDocument<R>`) when called without an options argument, but
they actually resolve to a mutation result object
(`{transactionId, documentIds, results}`, `MultipleMutationResult`). The
document is genuinely mutated, but code that read `._id` off the resolved
value was reading `undefined` at runtime without any type error. The
underlying method (`create()`) does return the document by default, so this
was easy to assume also held for `delete()` and `mutate()` - it does not.

Both methods now correctly type as resolving to `MultipleMutationResult` by
default, matching the (unchanged) runtime behavior, on both the
promise-based and observable clients.

Released as a patch rather than a major even though a declared type changed. Code that read `._id` off the result was reading `undefined` at runtime, so no working application can have depended on the old type: anything that type-checked against it was already broken when it ran. What changes is that the mistake is now visible at compile time instead of at runtime.

If `tsc` starts failing on one of these calls, that failure is pointing at a real bug. To fix it:

- To get the document back, pass `{returnFirst: true, returnDocuments: true}`
  explicitly: `await client.delete(id, {returnFirst: true, returnDocuments: true})`.
- To keep the mutation-result shape, read `documentIds` (or `documentId` with
  `returnFirst: true`) off the result instead of `_id`.

No runtime behavior changed - this only corrects the public types.
