---
'@sanity/client': minor
---

feat: add a reactive `auth` config option for credentials that change during the client's lifetime

`createClient({auth})` accepts an observable of promises of the current credential (`{token}`, `{withCredentials: true}` or `undefined`), for apps where the access token is refreshed or the user signs in and out while the client is alive. While a renewal is in progress, emit the promise the refresh returns. Requests and reconnects wait for it, so an expired token is never sent, and open `listen()` / `live.events()` streams reconnect once the new credential settles. See the "Reactive authentication" section of the README for the contract.

Also adds `client.getAuth()`, which resolves to the credential the client would send right now, and `client.observeAuth()`, which emits it and every change. Both work the same whether the client is configured with `auth` or with static options. Static `token` / `withCredentials` configuration is unchanged.

Under a reactive `auth`, `client.config().token` and `client.config().withCredentials` are `undefined`, since `config()` describes what was configured; use `client.getAuth()` to read the credential the client sends.
