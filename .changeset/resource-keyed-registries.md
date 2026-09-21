---
'@sanity/client': minor
---

feat: add per-resource schema, query and projection registries

`SanitySchemasByResource`, `SanityQueriesByResource` and `SanityProjectionsByResource` join the existing `SanityQueries` registry, following the same pattern: a global interface that the interface exported from `@sanity/client` inherits from, so a generated file can register either way and does not depend on module resolution.

Each is keyed by a resource, using the same string the App SDK already uses for its runtime cache, `projectId.dataset` for a dataset. This is what lets two datasets whose schemas disagree register different result types for the same query text, which the flat `SanityQueries` registry cannot express. Projections add a document-type level, because a projection resolves against whichever document the caller's handle names.

All three are empty by default and nothing in the client reads them yet. `client.fetch` and `ClientReturn` are unchanged, and keep resolving through the flat registry. They exist for consumers that do resource-aware lookups themselves, starting with the App SDK's hooks.
