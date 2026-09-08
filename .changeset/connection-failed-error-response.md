---
'@sanity/client': minor
---

feat: expose the rejected response on `ConnectionFailedError`

When the API rejects a `listen()` or `live.events()` connection (eg with a 401), the `ConnectionFailedError` now includes the rejected response in the same shape as `ClientError`: `response.body` holds the parsed API error payload (`{error, message, errorCode}`), `responseBody` the raw text, `statusCode` mirrors `status`, and `traceId` is read from the `traceparent` header. The error message is taken from the API payload ("Unauthorized - Session is expired") instead of the generic "EventSource connection failed". A rejection whose body could be read satisfies `isHttpError()`, so consumers can tell an expired session (`SIO-401-AEX`) apart from a permission denial with the same code they use for regular requests, without issuing a separate probe request. Which statuses are retried is unchanged.
