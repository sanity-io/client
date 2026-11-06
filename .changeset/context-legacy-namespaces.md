---
'@sanity/client': patch
---

**context:** restore the `client.context` namespaces Sanity CLI 8.27 and earlier call, alongside `client.context.request`

8.15.0 replaced `client.context`'s methods with `client.context.request`, which broke `sanity context` in CLI versions that call the old ones (for example `context mcp list` failed with "Cannot read properties of undefined (reading 'list')"). `knowledgeBases`, `mcpEndpoints`, `entries`, `issues`, `jobs`, `build()` and `cancelBuild()` are back, deprecated, as wrappers over `request` on routes the Context API still serves. `imports` and `refresh()` went with their routes, so they throw an error telling you to upgrade the Sanity CLI. `client.context.request` is unchanged, so CLI 8.28 and later keep working.
