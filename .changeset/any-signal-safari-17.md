---
'@sanity/client': patch
---

fix: use `any-signal` instead of `AbortSignal.any` so cancellable requests work on Safari 17.0-17.3
