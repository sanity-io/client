---
'@sanity/client': minor
---

Add an `instrumentation` option (beta) for observing a client's requests to the Sanity API. Its `onRequest` handler is called when a request attempt starts, including each retry and each `listen()` reconnect. It can return an object with an `onHeaders` handler, called when the response headers arrive, and an `onEnd` handler, called when the attempt ends.

Set it in the client config to observe the client's requests, including `listen()` connections and asset uploads but not `live.events()` connections. Or pass it to a single call, such as `fetch()`, `mutate()`, `action()` or `request()`.
