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
- `pnpm test:integration` - needs a build AND network access. This is the only suite that talks to the real Sanity API. It runs nightly and on version pull requests, not on every PR, so you will rarely need it locally.

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
