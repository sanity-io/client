---
'@sanity/client': patch
---

Requests with a body and no `method` are sent as POST, so they're no longer retried after 429, 502 and 503 responses or network errors.
