---
'@sanity/client': patch
---

fix: combine abort signals with `any-signal` instead of `AbortSignal.any`, so cancellable requests work on Safari 17.0 to 17.3 (which lack `AbortSignal.any`) as well as on Safari 17.4 and later
