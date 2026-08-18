# AGENTS.md

The rules for this repository are in [CONTRIBUTING.md](CONTRIBUTING.md). Read that file before you write code.

Three rules matter most:

- **Use no type assertions.** See [TypeScript: no type assertions](CONTRIBUTING.md#typescript-no-type-assertions).
- **Mock no module boundaries.** Tests reach the transport through the client's `resolveFetch` seam, backed by `get-it/mock`. See [Testing: the client, not the transport](CONTRIBUTING.md#testing-the-client-not-the-transport).
- **Environment differences are filenames, not guards.** No `skipIf`/`runIf` anywhere. See [Environment differences are filenames](CONTRIBUTING.md#environment-differences-are-filenames).

CONTRIBUTING.md also covers the development commands and how pull requests and releases work.
