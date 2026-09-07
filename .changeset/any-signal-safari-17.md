---
'@sanity/client': patch
---

fix: fall back to a plain `AbortController` where `AbortSignal.any` is missing, so cancellable requests work on Safari 17.0-17.3
