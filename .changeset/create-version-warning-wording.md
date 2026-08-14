---
'@sanity/client': patch
---

fix: reword the `createVersion()` warning about `baseId`

`createVersion({document})` warned that "the recommended approach is to provide a `baseId` and `releaseId` instead", which reads as a correction even when the caller had no other option: `baseId` creates a version of a document that already exists, so creating a genuinely new document inside a release can only be done by passing `document`.

The client cannot tell those two cases apart, so the warning is now phrased as a condition rather than a correction: "If you are creating a version of a document that already exists, prefer providing `baseId` and `releaseId` instead." No behavior changed, and both forms remain supported.
