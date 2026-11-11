import {execFile} from 'node:child_process'
import {resolve} from 'node:path'
import {promisify} from 'node:util'

import {test} from 'vitest'

const exec = promisify(execFile)

// `__dirname` rather than `import.meta.url`: Vite/vitest can rewrite
// `import.meta.url` in ways `node:path` can't resolve.
const packageDir = resolve(__dirname, '../..')

// Node always applies the `node` condition, which would pick `index.node.js`
// through the exports map, so the fetch build Metro resolves is imported by
// path. `--conditions=react-native` resolves its dependencies as Metro does.
test('the fetch build imports and creates a client without `Event` or `EventTarget`', async () => {
  await exec(
    'node',
    [
      '--conditions=react-native',
      resolve(packageDir, 'test/packaging/fixtures/react-native-import.mjs'),
      resolve(packageDir, 'dist/index.js'),
    ],
    {cwd: packageDir},
  )
})
