import type {TestProject} from 'vitest/node'

import {createUploadServer} from './uploadServer'

// The upload server has to bind in Node, while `browserUpload.test.ts`'s
// assertions run wherever the config collects them (happy-dom, or a real
// browser) - so the URL crosses that boundary via vitest's `provide`/`inject`
// channel instead of being created inside the test file itself.
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
