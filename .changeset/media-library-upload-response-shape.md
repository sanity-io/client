---
'@sanity/client': major
---

fix!: return the asset from `assets.upload()` against a Media Library

`client.assets.upload()` resolved to `undefined` when the client was
configured against a Media Library (`resource: {type: 'media-library', id}`),
even though the upload succeeded server-side. Content Lake's upload endpoint
responds with `{document: {...}}`, and `upload()` unwrapped that key
unconditionally - but the Media Library upload endpoint responds with
`{asset: {...}}` instead, so the unwrap produced `undefined`.

`upload()` now unwraps `.asset` for a Media Library response and `.document`
otherwise, on both the promise-based and observable clients.

The Media Library asset shape is not the same as a Content Lake asset
document: it is a `sanity.asset` document that tracks one or more uploaded
versions via `currentVersion`/`versions`, rather than a document with `url`,
`size`, `mimeType`, and so on. That shape is now exported as
`MediaLibraryAssetDocument`, and `assets.upload()`'s return type has widened
to include it:

- `upload('image', ...)` now resolves to `SanityImageAssetDocument | MediaLibraryAssetDocument`
- `upload('file', ...)` now resolves to `SanityAssetDocument | MediaLibraryAssetDocument`

Which one you get back depends on how the client is configured (a Media
Library resource or a project/dataset), not on the arguments to `upload()`,
so narrow on the response (for example, check for `currentVersion`) before
reading fields specific to either shape.
