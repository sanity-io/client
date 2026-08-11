---
'@sanity/client': patch
---

fix: route the live-events CORS probe through the configured transport

The `/check/cors` probe that `client.live.events()` uses to distinguish a CORS
rejection from other connection failures called the global `fetch` directly, so
a custom `resolveFetch` or an explicit `proxy` was not applied to it. It now
resolves the same fetch the EventSource connection uses.
