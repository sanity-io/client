---
'@sanity/client': patch
---

fix: return the asset from `assets.upload()` against a Media Library

`client.assets.upload()` resolved to `undefined` when the client was configured against a Media Library (`resource: {type: 'media-library', id}`), even though the upload succeeded server-side. Content Lake's upload endpoint responds with `{document: {...}}`, and `upload()` unwrapped that key unconditionally - but the Media Library upload endpoint responds with `{asset: {...}}` instead, so the unwrap produced `undefined`.

`upload()` now unwraps `.asset` for a Media Library response and `.document` otherwise, on both the promise-based and observable clients. It resolves to the uploaded asset instead of `undefined`.

The Media Library asset shape is not the same as a Content Lake asset document: it is a `sanity.asset` document that tracks one or more uploaded versions via `currentVersion`/`versions`, rather than a document with `url`, `size`, `mimeType`, and so on. That shape is now exported as `MediaLibraryAssetDocument`.

**The declared return type is knowingly incomplete, and this is a patch on purpose.** Which shape you get back depends on how the client is configured, not on the arguments to `upload()`, so no overload can discriminate it. Expressing it would mean widening the return type into a union that every existing caller has to narrow - a breaking change for all users, to correct the typing of a much less common configuration. So the declared type still describes only the Content Lake shape. If you upload to a Media Library, narrow the result yourself (for example, check for `currentVersion`) or annotate it as `SanityImageAssetDocument | MediaLibraryAssetDocument`. Typing this accurately is deferred to the next major.
