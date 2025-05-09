/**
 * This detects dependencies that are ESM-only and cannot be imported using CommonJS require().
 * In Node.js environments (especially v12+), some packages are distributed exclusively as ES Modules,
 * which breaks compatibility with CommonJS code that tries to require them directly.
 */

/* eslint-disable no-console */

import fs from 'fs'
import {createRequire} from 'module'
import path from 'path'
import {fileURLToPath} from 'url'

const currentFilename = fileURLToPath(import.meta.url)
const currentDirname = path.dirname(currentFilename)
const dynamicRequire = createRequire(import.meta.url)

const pkgJsonPath = path.join(currentDirname, '../package.json')

const deps = Object.keys(JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).dependencies || {})

const esmOnlyDeps = []

for (const dep of deps) {
  try {
    dynamicRequire(dep)
  } catch (err) {
    if (err.code === 'ERR_REQUIRE_ESM') {
      esmOnlyDeps.push(dep)
    } else {
      console.log(`${dep} encountered an unexpected error: ${err.message}`)
    }
  }
}

if (esmOnlyDeps.length > 0) {
  console.log(`Found ${esmOnlyDeps.length} ESM-only dependencies: ${esmOnlyDeps.join(', ')}`)
  process.exit(1)
}
