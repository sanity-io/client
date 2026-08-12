import type {TestProject} from 'vitest/node'

import {createUploadServer} from './uploadServer'

// The upload server has to bind in Node, while `browserUpload.browser.test.ts`'s
// assertions run in the browser - only `vitest.browser.config.ts` collects
// that file (see `browserOnlyExclude` in vitest.config.ts; happy-dom does
// NOT collect it) - so the URL crosses that process boundary via vitest's
// `provide`/`inject` channel instead of being created inside the test file
// itself.
export async function setup(project: TestProject) {
  const server = await createUploadServer()
  project.provide('uploadServerUrl', server.url)
  return () => server.close()
}

declare module 'vitest' {
  interface ProvidedContext {
    uploadServerUrl: string
  }
}
