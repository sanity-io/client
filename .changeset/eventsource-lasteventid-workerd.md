---
'@sanity/client': patch
---

fix: populate server-sent event IDs on Cloudflare Workers

`client.live.events()` and `client.listen()` read `lastEventId` off the
`MessageEvent` that `eventsource` constructs. workerd does not carry that member
through the `MessageEvent` constructor's init dict, so on bare Cloudflare Workers
every event arrived with an empty `id`. Raising the `eventsource` floor to
`>= 5.1.0` picks up the fix.
