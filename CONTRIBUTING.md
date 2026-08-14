# Contributing to @sanity/client

Thank you for your interest in @sanity/client. We welcome bug reports, bug fixes, documentation, and new features.

## Development

You need Node.js 22.12 or later, and pnpm.

```bash
pnpm install
pnpm test       # unit tests, on Node
pnpm typecheck
pnpm knip
```

The suite also runs against every other supported environment: happy-dom, real browsers, React Server Components, Vercel Edge, workerd, Bun, Deno, and a Next.js typecheck. CI runs all of these on every pull request, so you do not have to run them all locally. If you do want to run one:

- `pnpm test` - Node.
- `pnpm test:happy-dom` - happy-dom.
- `pnpm test:browser` - real browsers (chromium, firefox, webkit) via Playwright.
- `pnpm test:react-server` - React Server Components.
- `pnpm test:vercel-edge` - the Vercel Edge runtime.
- `pnpm test:workerd` - Cloudflare's workerd runtime.
- `pnpm test:bun` - Bun.
- `pnpm test:deno` - Deno.
- `pnpm test:next` - typecheck only. It checks the Next.js App Router typings for fetch `cache`, `next.revalidate`, and `next.tags`; it runs no runtime tests.
- `pnpm test:packaging` - needs a build (`pnpm build` first). Runs against `dist/` and the real `package.json` `exports` map, to catch failures a source-aliased suite cannot see.
- `pnpm test:integration` - needs a build AND network access. This is the integration smoke suite (see "Integration smoke tests" below), the only suite that talks to the real Sanity API. It runs on every pull request commit as well as nightly, so a change that breaks a real API contract fails on the pull request that introduced it. Running it locally needs a token; see that section.

Other useful commands:

```bash
pnpm coverage    # run tests with coverage
pnpm typecheck   # tsc --noEmit
pnpm knip        # unused files, exports and dependencies
pnpm lint        # oxlint
pnpm format      # oxfmt
```

`pnpm knip` is expected to exit 0. It carries a few narrow, documented ignores in `knip.json` rather than a blanket rule downgrade, so read the comments there before adding another.

One note on dependencies: the `eventsource` floor is `>= 5.1.0` for a reason. Earlier versions relied on `MessageEvent`'s constructor init dict round-tripping `lastEventId`, which workerd does not do, so server-sent event IDs arrived empty on Cloudflare Workers. Do not relax that floor without confirming `pnpm test:workerd` still passes. The upstream fix is tracked in [cloudflare/workerd#6995](https://github.com/cloudflare/workerd/pull/6995).

Before you write code, read the sections below. They hold the rules for TypeScript and for tests.

## TypeScript: no type assertions

**Never use a type assertion (`as`, `<Type>`, `as any`, `as unknown as X`).** There is no acceptable use in new code, in `src` or in tests.

This is a bar for new code, not a description of the codebase today: pre-existing assertions in both `src` and `test` predate the rule and are being removed opportunistically as code is touched, not in a dedicated sweep.

When a type does not match, one of these is true:

1. The upstream type is wrong. Correct it at the source.
2. You must narrow the type. Use `typeof`, `instanceof`, `in`, a discriminated union, or a type guard.
3. You need a user-defined type guard. Write an `is` predicate function.

```ts
// WRONG: all of these
const value = response as MyType
const data = result as any
const headers = obj as Record<string, string>
const parsed = JSON.parse(raw) as Config

// RIGHT: narrow instead
function isMyType(value: unknown): value is MyType {
  return typeof value === 'object' && value !== null && 'key' in value
}

if (isMyType(response)) {
  // response is MyType here
}
```

If `JSON.parse` returns `unknown` and you need a specific shape, write a type guard for that shape. If a library returns `any`, wrap it with a type guard at the boundary. Use no shortcuts.

### Testing invalid input

The rule above is about types that fail to match by accident. Sometimes a test needs to pass input that is invalid on purpose, to check that the client rejects it at runtime. For that, use `@ts-expect-error` with a reason after `--`:

```ts
expect(
  // @ts-expect-error -- set() requires an object, not a string
  () => patch.set(null),
).toThrow(/set\(\) takes an object of properties/)
```

This is not the same as suppressing a type error. Silencing a genuine mismatch in `src` so `pnpm typecheck` goes green is never acceptable, by this or any other mechanism. Asserting in a test that a call must fail to typecheck is acceptable, because `@ts-expect-error` self-invalidates: if a later change makes the call legal, `tsc --noEmit` fails with "Unused '@ts-expect-error' directive". An `as any` cast on the same line would not catch that. It would keep compiling forever, so the test could silently stop testing what its name claims.

The reason after `--` is mandatory, matching every other `@ts-expect-error` in this codebase. A directive suppresses every error on its line, so the reason is what stops it from later swallowing an unrelated one.

## Testing: the client, not the transport

`get-it` and `eventsource` are the transports, and they have their own test suites in their own repositories. This suite tests **the client**: the URLs it builds, the payloads it assembles, the responses it parses, the errors it maps.

Requests therefore go through the client's own `resolveFetch` seam, backed by `get-it/mock`:

```ts
const client = createClient({...clientConfig, resolveFetch: testResolveFetch})
getActiveMock()
  .scope('https://abc123.api.sanity.io')
  .on('GET', '/v1/users/me')
  .respond({status: 200, body: {}})
```

This includes server-sent events. `resolveEventSourceFetch` routes the EventSource connection through `config.resolveFetch`, so `client.listen()` and `client.live.events()` are driven by the same mock, using `encode()` from `eventsource-encoder` to build frames and `streamBody(..., streamStall())` for connections that stay open. Handlers are one-shot and consumed in registration order, so registering the same route twice models two successive connections. `assertAllConsumed()` in teardown turns a registered-but-unhit handler into a test failure.

- **Do not mock a module.** No `vi.mock()`, no `vi.doMock()`, no `vi.spyOn` on a module's exported function. If you need a function directly, export it from its own module and mark it `@internal`.
- **Do not stand up an HTTP server.** There is exactly one exception, below.

A couple of carve-outs are fine, because they observe an environment global or a designed-in output channel rather than mocking a module boundary:

- `vi.spyOn(console, 'warn')` is fine. It observes the warnings this suite exists to test, not a collaborator of the code under test.
- `vitest.stubGlobal('location', ...)` (or `'window'`) works in Node, happy-dom and the Vercel Edge test environment. It does **not** work in real browsers: `Location` and `Window` attributes are `[LegacyUnforgeable]` per the HTML spec, a deliberate security property, so the stub throws there instead of silently replacing anything. A test that needs a deterministic origin under real browsers must catch that throw and derive the origin dynamically from the real `location`. This is non-obvious and cost real debugging time; see `stubLocationOrigin()` in `test/live.test.ts` for the pattern.

### The one exception

`src/http/browserUpload.ts` uses `XMLHttpRequest`, because fetch has no upload-progress hook and `client.assets.upload()` needs to emit `progress` events. A fetch mock cannot intercept XHR, so this one path is tested against a real local server, in real browsers, via `test/helpers/uploadServer.ts` (started through `globalSetup` and reached through vitest's `provide`/`inject` channel).

Please do not "simplify" this back into a fake `XMLHttpRequest` class. That is what it used to be, and it meant the progress events were never actually exercised in any browser.

Two coverage gaps in this path are deliberate, not oversights:

- The `timeout` option on `assets.upload()` has no automated coverage. Observing `xhr.timeout` needs either a fake XHR or a real timing wait, and both were rejected as not worth the flake.
- `browserUpload.ts`'s error-mapping and abort logic run only in the browser CI job, not in Node or happy-dom.

## Environment differences are filenames

The same suite runs in every supported environment: Node, chromium, firefox, webkit, happy-dom, react-server, Vercel Edge, workerd, Bun and Deno. There are exactly two suffixes, both exported from `vitest.config.ts`:

- `*.node.test.ts` - needs Node APIs. `nonNodeExclude` excludes these from every non-Node config.
- `*.browser.test.ts` - needs a real browser engine. `browserOnlyExclude` excludes these from every non-browser config.

There is no `skipIf`/`runIf` anywhere in the suite, and there should never be one. Do not use an inline `skipIf(isEdge)` or `typeof document !== 'undefined'` guard. The suite used to have around 205 of them, most of which existed only because a test bound a local server, and they made it impossible to tell an intentional environment difference from an accident.

Move a test into a suffixed file only after you have established the dependency empirically, by actually running it in the environment you think cannot support it. This project hit the opposite failure three separate times: relocating a test to a narrower environment than its dependency actually required, which silently deleted coverage under the banner of a cleanup. The genuine dependencies found looked like this:

- A `User-Agent` header override - real browsers and edge runtimes block a scripted `User-Agent`, so that test can only run on Node.
- `node:events`'s `getEventListeners` - it rejects happy-dom's `AbortSignal`, which comes from a different realm than the one Node's `events` module expects.
- `fs.createReadStream` fixture uploads - only Node has `fs`.

Each time, the fix was to measure first: run the test unguarded in the environment it was moved out of, and see whether it actually fails there. Two of the three times, most of the moved tests turned out to have no real dependency at all and moved back.

## Integration smoke tests

Every other suite in this repo mocks the transport: requests go through the client's `resolveFetch` seam into `get-it/mock`, and nothing reaches the network (see "Testing: the client, not the transport" above). That stays the default. It is what makes the rest of the suite hermetic and fast.

`test/**/*.integration.test.ts` is the exception. Each file in it makes real requests, with a real token, against a real Sanity project and dataset. Mocks are only as good as the assumptions behind them, and those assumptions can drift from what the API actually does. This suite exists to catch that drift before it reaches users.

Keep it minimal. One smoke test per feature that could significantly change the client's behavior, asserting that the round trip works: a query returns the document you just wrote, a listener connects, a mutation lands. This is not the place for a matrix of every flag and option a feature supports. The hermetic suite already covers that, without needing the network.

For what is covered today, read `test/integration/`: one file per feature, named after it. Every test there carries a docblock explaining why it needs the network and what a mock could not catch. Write that docblock when you add one; it is the part that stops the next person from deleting the test as redundant.

An error path can earn a place here, and that is not a departure from "assert the round trip". What justifies one is that the interesting behavior is a mapping the client does not author: it reads a body whose shape the API decides. So assert that the client surfaced the server's own diagnosis, never just that something threw. Note that the same mistake surfaces differently per feature - a bad query rejects an HTTP request, while the listen endpoint accepts the connection and reports it as a server-sent `error` frame - so find out how it actually arrives instead of assuming.

### Two tokens, and why

Most of the suite uses `SANITY_INTEGRATION_TOKEN`, a project-scoped Editor token.

Agent Actions and Media Library both need `SANITY_INTEGRATION_ORG_TOKEN` instead, an organization-scoped token. Agent Actions requires the `sanity.organization/read` grant, which no project token can carry however broad its project role. Media Library uploads fail the same way: a project token gets "Insufficient permissions" against the upload endpoint, however broad its project role. The two are kept separate from the project token on purpose: the other tests have no business holding organization-wide credentials. Note that an organization token also needs a role that actually grants org read; the organization's default `member` role does not, and a token without it authenticates fine but sees no organizations.

### API versions

The suite pins one dated `apiVersion`, and some features reject it: Agent Actions rejects dated versions entirely and needs `vX`, and release actions are refused with `action index 0: not supported for this API version` on anything before `2025-02-19`. Probe the boundary rather than guessing, and when a feature needs its own version, add a dedicated client factory in `test/integration/helpers.ts` documenting what you found. Prefer a dated version over `vX`, so the suite keeps the determinism it pins for.

### Releases, and anything else that mutates state beyond a document

Releases are the sharpest example of the cleanup rules below, so read this before touching them or adding anything similar.

- Releases are a state machine, and most actions are legal only from certain states. Publishing is effectively terminal, and only an `archived` or `published` release can be deleted. Walk one release through a lifecycle rather than writing an isolated test per action, each of which would have to build its own precondition against real state.
- Some transitions are asynchronous. `publish()` resolves while the release is still in `publishing`, and acting on it then fails with "not permitted to transition from state publishing to ...". Poll for the state you need; do not assume the action's promise resolving means it finished.
- Cleanup has to work from whatever state a mid-test failure left behind: unschedule if scheduled, wait out any transition in flight, archive if active, then delete. And clean up what the actions created, not just the release - publishing a release writes real documents into the dataset.
- Ids compose. A document in a release is stored as `versions.<releaseId>.<documentId>`, and the client rejects document ids over 128 characters, which is why `uniqueReleaseId()` is terser than `uniqueDocumentId()`.
- `releases.fetchDocuments()` is a GROQ query (`*[sanity::partOfRelease($releaseId)]`), so it needs polling like any other - and it returns nothing under the default perspective, so it needs `perspective: 'raw'` from the client config. Its own options type carries no `perspective`, even though the API honours one.

Two more limits worth knowing:

- The Media Library smoke test uploads a real image and deletes it afterwards. The library dedupes uploads by content hash, so re-uploading identical bytes fails with "asset already exists" - the test generates unique bytes per run (a random UUID embedded as a JPEG comment segment) so concurrent runs of the integration matrix don't collide. `client.mediaLibrary.video.getPlaybackInfo()` remains hermetic-only: it would need a real video asset uploaded to the library, which this suite has no way to provision.
- The Agent Actions test asserts the response is a non-empty string rather than matching exact content. Asking a model for an exact word and asserting it would flake on nondeterminism, which defeats the purpose. It also costs real inference per run, so keep it to one call.

### Naming

Integration smoke tests live in `test/integration/` and are named `<feature>.integration.test.ts`. The doubled suffix is deliberate: `test/live.test.ts` is a hermetic unit suite, and a bare `test/integration/live.test.ts` would collide with it on basename in editor tabs and test output. `vitest.integration.config.ts` collects tests by the `.integration.test.ts` suffix rather than by directory, so the same naming rule is what selects a test into this suite even if a file ever needs to live outside `test/integration/`.

### Running locally

You need your own token. Create an Editor-role token for the integration project's dataset rather than sharing one, and never commit a token or put one in a fixture.

```bash
export SANITY_INTEGRATION_TOKEN=your-token-here
pnpm run build
pnpm run test:integration
```

`createIntegrationClient()` in `test/integration/helpers.ts` throws immediately if `SANITY_INTEGRATION_TOKEN` is missing, rather than skipping. CI always has the secret, so a missing token locally means the suite was invoked without the setup above, and that should fail loudly instead of silently passing or skipping.

### Pointing the suite somewhere else

The project, dataset and Media Library the suite targets all fall back to the provisioned defaults, so the normal path needs no configuration. Override them to reproduce a failure against your own project, or to run two branches concurrently without them competing for the same documents:

- `SANITY_INTEGRATION_PROJECT_ID` (defaults to the CI project)
- `SANITY_INTEGRATION_DATASET` (defaults to `test`)
- `SANITY_INTEGRATION_MEDIA_LIBRARY_ID` (defaults to the CI organization's library)

Supply a matching token alongside any override: the default tokens are scoped to the default project and organization. The Media Library is an organization-level resource, so overriding the project does not imply overriding the library, or the reverse. An empty value counts as unset, so that a CI secret which fails to resolve falls back to the default rather than silently targeting `projectId: ''`.

### Rules for this suite

- Self-contained: a test that needs a document creates it and deletes it in a `finally`. Never depend on seeded content, and never leave anything behind.
- Unique ids per run, built with `crypto.randomUUID()`, so concurrent runs cannot collide.
- Assert the round trip, not the shape of the whole world. Do not assert on event payloads that depend on other activity in the dataset, and do not assert on anything administered outside this suite: assert that a dataset or project is in a list, never how many there are, or whose name they carry.
- Nothing may depend on which of two concurrent things wins. Cancelling a request, for example, aborts the signal _before_ the call rather than on a timer, because `setTimeout(() => abort(), n)` races the network and either passes for the wrong reason or flakes in CI. Cover the deterministic half here and leave the racy half hermetic.
- Assert what all five runtimes agree on. The runtime's own `fetch` produces an aborted request's rejection, so match on `name === 'AbortError'` (which the DOM standard fixes) rather than on a concrete class.
- No `skipIf`/`runIf`/`.skip`/`.todo`, same rule as the rest of the suite. If a feature cannot be exercised with the tokens and provisioning available, document the gap here instead of writing a test that never runs.
- Never query for a document you just wrote without polling. Content Lake acknowledges a write before the query index has caught up, so `create()` can resolve, and the document be readable through the `/doc` endpoint, while a GROQ query for it still returns nothing. Use `fetchUntilVisible()` from `test/integration/helpers.ts`. This lag is usually far under the first poll interval, which is what makes it dangerous: a single fetch passes every time locally and fails occasionally in CI. `getDocument()` and `getDocuments()` read the document store directly and need no polling.
- Keep assertions outside the polling helper, and let request errors propagate. `fetchUntilVisible()` retries only on absence, so a wrong value or a 401 fails immediately instead of being retried until the deadline.

This suite runs on every pull request commit and nightly (see `.github/workflows/live.yml`).

Fork pull requests are the one exception: they do not receive the `SANITY_INTEGRATION_TOKEN` secret, and the workflow skips the job rather than run it token-less and fail. So a contributor working from a fork gets no integration coverage on their pull request, while a maintainer pushing the same branch to this repository does. If you are reviewing a fork pull request that touches request building, response parsing, or the SSE paths, push the branch here to get the integration run before merging.

## Pull requests, changesets, and releases

Give the pull request a conventional-commit title. A CI check enforces this format. The title sets the version bump:

- `feat:` gives a minor release
- `fix:`, `perf:`, or `revert:` gives a patch release
- `feat!:`, or a `BREAKING CHANGE:` line in the body, gives a major release
- All other types (`docs:`, `chore:`, `test:`, `build:`, `ci:`, `refactor:`, `style:`) give no release

A bot writes a [changeset](https://github.com/changesets/changesets) from your PR title automatically when the PR changes a published file. To write your own release note instead, run `pnpm changeset` and commit the file; the bot then leaves your PR alone.

This repository releases from two lines:

- `main` is the current major (v8). It owns the `latest` npm dist-tag and the "Latest" badge on GitHub releases.
- `v7` is the maintenance branch for the previous major. It publishes under the `latest-v7` npm dist-tag, and its GitHub releases are created without `--latest`.

Each line publishes independently through the same changesets workflow, so a v7 bugfix release never steals `latest` away from the current major.

Do not put statistics in commit messages or pull request bodies: no counts of files built, tests passing, or "lint is clean." Report locally, in the PR description, only when tests are failing and should not be.
