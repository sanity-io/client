import assert from 'node:assert/strict'
import process from 'node:process'

import {assertNodeStreamBodies} from './stream-bodies.mjs'

assert.ok(process.versions.bun, 'The package smoke test must run under Bun')
await assertNodeStreamBodies(process.argv[2])
