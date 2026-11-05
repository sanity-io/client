---
'@sanity/client': minor
---

`client.context` calls the Context API through one call typed from its OpenAPI spec

**Breaking for `client.context`**, which is `@beta` and served by an experimental API version. Every hand-written method is gone: `knowledgeBases.*`, `sources.*`, `documents.*`, `build()`, `cancelBuild()`, `sync()`, `jobs.*`, `issues.*`, `instructions.*`, `entries.*`, `mcpEndpoints.*` and `conversations.*`, along with the request and response type aliases that duplicated the spec. In their place:

- `client.context.request(route, init)` calls any Context API operation by `METHOD /path`, as the spec writes it after `/{apiVersion}/context`. Path parameters, query, headers and body are typed from the spec, and so is the result. `knowledgeBaseId` defaults to a `knowledge-base` resource and `organizationId` to `context.organizationId`. `client.observable.context.request` returns an observable.

  ```ts
  const source = await client.context.request('POST /knowledge-bases/{knowledgeBaseId}/sources', {
    params: {knowledgeBaseId: 'kb3do82whm'},
    body: {type: 'web', url: 'https://example.com/docs'},
  })
  ```

- `client.context.requestBytes(route, init)` resolves with the response bytes, for a document's content with `format: 'raw'`.
- `client.context.uploadFile({sourceId, file, filename, contentType?})` stages an upload, PUTs the bytes to the signed storage URL and syncs the source. `client.context.createFileSource({type: 'files', title, file, filename})` adds a `files` source holding the file.
- `client.context.fetch` and `client.context.listen` are unchanged.
- The `Context` namespace exports the generated `paths`, `operations` and `components`, the `Route`, `RequestInit`, `Response`, `Body`, `PathParams` and `QueryParams` helpers, and the `sanity.context.*` document shapes (`EntryDoc`, `IssueDoc`, `InstructionDoc`, `McpDoc`, `ConversationDoc`) for typing GROQ reads.

The canned GROQ reads (`entries.list`, `issues.list`, `mcpEndpoints.get` and so on) are gone too: query the document store with `client.context.fetch`.

The Context API also moved from imports to sources, syncs and documents: `imports.*` and `refresh()` have no route any more, and sources are now the websites, datasets and files a knowledge base reads.
