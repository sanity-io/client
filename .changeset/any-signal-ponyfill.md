---
'@sanity/client': patch
---

fix: drop the `any-signal` dependency in favour of an `AbortSignal.any` ponyfill that uses the native static where it exists and a plain `AbortController` on Safari 17.0-17.3
