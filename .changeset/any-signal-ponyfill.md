---
'@sanity/client': patch
---

fix: drop the `any-signal` dependency and combine abort signals with `get-it/any-signal`, which uses native `AbortSignal.any` where it exists and a plain `AbortController` on Safari 17.0-17.3
