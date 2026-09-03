---
'@sanity/client': minor
---

feat: read query result types from a global `SanityQueries` interface

Query result types can now be registered on a global `SanityQueries` interface, which the `SanityQueries` interface exported from `@sanity/client` inherits from. `client.fetch`, `ClientReturn` and `ClientReturnStega` resolve registrations made either way, so the `declare module '@sanity/client'` augmentation that Sanity TypeGen has emitted so far keeps working unchanged. The global registry does not depend on module resolution: it is seen whether or not `@sanity/client` is a direct dependency of the generated file, however many copies of the client are installed, and from every entry point including `@sanity/client/stega`.
