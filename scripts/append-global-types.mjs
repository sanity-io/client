/**
 * Re-adds the global `SanityQueries` declaration to the built `.d.ts` rollups.
 *
 * `src/types.ts` declares a global `SanityQueries` interface that the exported `SanityQueries`
 * extends, so that `sanity typegen` can register query result types without a module augmentation
 * of `@sanity/client`. API Extractor, which produces the `.d.ts` rollups on this branch, only
 * follows exported declarations and drops `declare global` blocks entirely
 * (https://github.com/microsoft/rushstack/issues/3898). Without the block, every rollup that
 * inlines `interface SanityQueries extends globalThis.SanityQueries` refers to a global that
 * nothing declares, which is a hard error for any consumer with `skipLibCheck: false` and no
 * typegen output.
 *
 * Runs after `pkg build` in the `build` script, and appends the block to every rollup that inlines
 * the interface. Idempotent, and fails when no rollup matched so a tooling change cannot silently
 * ship a broken declaration file.
 */

/* eslint-disable no-console */

import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')

const EXTENDS_GLOBAL = 'interface SanityQueries extends globalThis.SanityQueries'
const GLOBAL_BLOCK_MARKER = '  interface SanityQueries {}\n}'
const GLOBAL_BLOCK = `
declare global {
  /**
   * Query result types, keyed by GROQ query string. Empty by default, \`sanity typegen\` registers
   * the queries it finds:
   * \`\`\`ts
   * declare global {
   *   interface SanityQueries {
   *     '*[_type == "post"]': PostsQueryResult
   *   }
   * }
   * \`\`\`
   * \`client.fetch(query)\` and \`ClientReturn<typeof query>\` then resolve to the registered type.
   *
   * The registry is a global rather than a module augmentation of \`@sanity/client\` so that it
   * does not depend on module resolution: it resolves the same whether \`@sanity/client\` is a
   * direct dependency, how many copies of it are installed, and from every subpath export.
   */
  interface SanityQueries {}
}
`

const rollups = fs
  .readdirSync(distDir)
  .filter((file) => file.endsWith('.d.ts'))
  .map((file) => path.join(distDir, file))
  .filter((file) => fs.readFileSync(file, 'utf8').includes(EXTENDS_GLOBAL))

if (rollups.length === 0) {
  console.error(
    `append-global-types: no file in ${distDir} declares \`${EXTENDS_GLOBAL}\`. ` +
      'Either the rollup no longer inlines the interface or the source changed; ' +
      'update this script rather than shipping a declaration file that refers to an undeclared global.',
  )
  process.exit(1)
}

for (const file of rollups) {
  const source = fs.readFileSync(file, 'utf8')
  if (source.includes(GLOBAL_BLOCK_MARKER)) {
    console.log(`append-global-types: ${path.relative(process.cwd(), file)} already has the block`)
    continue
  }
  fs.writeFileSync(file, `${source.trimEnd()}\n${GLOBAL_BLOCK}`)
  console.log(
    `append-global-types: appended the global SanityQueries block to ${path.relative(process.cwd(), file)}`,
  )
}
