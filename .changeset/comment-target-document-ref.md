---
'@sanity/client': minor
---

feat: export `getCommentTargetDocumentRef`

Builds the global document reference a collaboration comment stores in `target.document._ref` from a resource and a document ID, with no client involved. `client.collaboration.comments.getTargetDocumentRef` is unchanged and now calls it, reading the resource off the client's configuration.

Until now the reference could only be built through a client instance, which meant code that needs it somewhere a client should not be fetched or created, such as a state selector, had to reach for one anyway. Pass the same value `ClientConfig['resource']` takes, for example `{type: 'dataset', id: 'abc123.production'}`.
