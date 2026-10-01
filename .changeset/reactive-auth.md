---
'@sanity/client': minor
---

feat: add a reactive `auth` config option for credentials that change during the client's lifetime

`createClient({auth})` accepts an observable of promises of the current credential (`{token}`, `{withCredentials: true}` or `undefined`), for apps where the access token is refreshed or the user signs in and out while the client is alive. Emit the refresh itself while a renewal is in progress: requests and reconnects wait for it, so an expired token is never sent, and open `listen()` / `live.events()` streams reconnect once the new credential settles. See the "Reactive authentication" section of the README for the contract.

Also adds `client.getAuth()`, which resolves to the credential the client would send right now. Static `token` / `withCredentials` configuration is unchanged.

Deprecated: reading `client.config().token` and `client.config().withCredentials`. They are unsafe under a reactive `auth`, where the value may be stale or not yet resolved. Use `client.getAuth()` instead.
