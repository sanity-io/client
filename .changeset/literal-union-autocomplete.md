---
'@sanity/client': patch
---

fix: restore editor autocomplete for `StackablePerspective` and `StudioBaseUrl`

Both types applied the `& {}` autocomplete idiom around the whole union rather than around the
`string` member, as in `('published' | 'drafts' | string) & {}`. That collapses to plain `string`,
so editors offered no completions for `published` or `drafts`, and the three template literal
patterns in `StudioBaseUrl` had no effect. Assignability is unchanged, so this only adds
suggestions that were always intended to be there.
