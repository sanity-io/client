/**
 * 
 * Using private properties with a # prefix in classes pose problems that 
 * tend to can be painful to resolve in userland. If there are more than one `@sanity/client`
 * package in `node_modules` then TS is unable to resolve checks like:
 * ```
 * import {SanityClient} from 'sanity' // resolves to ./node_modules/sanity/node_modules/@sanity/client
 
 * function isSanityClient(client: unknown): client is SanityClient {
 *   return client instanceof SanityClient
 * }
 * ```
 * The above check will fail in a scenario like this:
 * ```
 * import {createClient} from '@sanity/client' // resolves to ./node_modules/@sanity/client
 * 
 * console.log(isSanityClient(createClient({})))
 * ```
 * The above will throw a confusing error like:
 * ```
 * Argument of type 'import("/node_modules/@sanity/client/dist/index").SanityClient' is not assignable to parameter of type 'import("/node_modules/sanity/node_modules/@sanity/client/dist/index").SanityClient'.
 * The types of 'observable.listen' are incompatible between these types.
 * ```
 * It's possible to resolve these by deduping the dependency using `pnpm`, `npm` or `yarn`.
 * But not always, and more importantly, it's seldom obvious that's what the problem is.
 * Thus we strip the `#private` annotations from the generated `.d.ts` files.
 */

import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const readPackageJsonTypesExports = () => {
  const packageJsonPath = path.join(__dirname, '../package.json') // Adjust if your package.json is not in the same directory
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const exportsEntries = Object.values(packageJson.exports)

  // Extract 'types' entries
  const dtsPaths = exportsEntries
    .map((entry) => {
      if (typeof entry === 'object' && entry.types) {
        return entry.types
      }
      return null
    })
    .filter((dir) => dir !== null)

  return dtsPaths
}

const removePrivateFields = (filePath) => {
  const data = fs.readFileSync(filePath, 'utf8')
  const result = data
    .split('\n')
    .filter((line) => !line.includes('#private'))
    .join('\n')
  fs.writeFileSync(filePath, result, 'utf8')
}

const dtsFiles = readPackageJsonTypesExports()
dtsFiles.forEach((file) => {
  const filePath = path.join(__dirname, '..', file)
  removePrivateFields(filePath)
})
