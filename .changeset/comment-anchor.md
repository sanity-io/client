---
'@sanity/client': minor
---

feat(collaboration): accept comment `anchor`, deprecate `range`

Create and update now take a typed `anchor` (`type: "portable-text"` with optional `fieldValue` on the anchor). Deprecated `range` + top-level `fieldValue` (and `range: null`) are still accepted and sent as `anchor`.
