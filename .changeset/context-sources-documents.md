---
'@sanity/client': minor
---

feat(context): sources, syncs and documents replace imports

`client.context` follows the Context API's move from imports to sources, syncs and documents. This removes `context.imports`, `context.refresh()`, `sources.content` and the old document-level `sources.list` filters, all of which the Context API no longer serves.

- `context.sources` manages websites, Sanity datasets and files: `create`, `preview` (a crawl dry run), `list`, `get`, `edit`, `delete`, and `upload` to replace a `files` source's file. `sources.create({type: 'files', title, file, filename})` adds the source, uploads the file and syncs it in one call, as `imports.create({type: 'file'})` did.
- `context.sources.syncs` lists, starts, and confirms or discards held syncs. `context.sources.uploads.create` stages an upload for callers that PUT the bytes themselves.
- `context.sync()` queues a sync of every website and dataset source, replacing `context.refresh()`.
- `context.documents` lists, reads, keeps and deletes the documents sources yield. `documents.content` returns a document's markdown, a chunk or a line range, or with `format: 'raw'` the bytes the source gave.
