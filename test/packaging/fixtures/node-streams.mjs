import process from 'node:process'

import {assertNodeStreamBodies} from './stream-bodies.mjs'

await assertNodeStreamBodies(process.argv[2])
