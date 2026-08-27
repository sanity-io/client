import {isBuiltin} from 'node:module'
import {relative, resolve} from 'node:path'

import {rolldown} from 'rolldown'
import {describe, expect, test} from 'vitest'

interface NonNodeTarget {
  aliasFields: string[][]
  conditionNames: string[]
  name: string
  mainFields: string[]
}

// `__dirname` rather than `import.meta.url`: Vite/vitest can rewrite
// `import.meta.url` in ways `node:path` can't resolve.
const packageDir = resolve(__dirname, '../..')
const fetchEntry = resolve(packageDir, 'dist/index.js')

/**
 * Conditions, legacy package entry fields and browser-field aliases asserted
 * by representative non-Node consumers. Some server and worker runtimes also
 * assert `node` for compatibility, so those cases verify that a more specific
 * condition keeps both this package and its dependencies on their neutral
 * branches. Rolldown replaces its default condition list when configured, so
 * each target includes the implicit `import` and `default` conditions.
 */
const nonNodeTargets: NonNodeTarget[] = [
  {
    aliasFields: [],
    conditionNames: ['import', 'default'],
    name: 'default',
    mainFields: ['module', 'main'],
  },
  {
    aliasFields: [['browser']],
    conditionNames: ['import', 'browser', 'default'],
    name: 'browser',
    mainFields: ['browser', 'module', 'main'],
  },
  {
    aliasFields: [['react-native'], ['browser']],
    conditionNames: ['import', 'require', 'react-native', 'default'],
    name: 'react-native',
    mainFields: ['react-native', 'browser', 'main'],
  },
  {
    aliasFields: [],
    conditionNames: ['import', 'react-server', 'node', 'module', 'default'],
    name: 'react-server',
    mainFields: ['module', 'main'],
  },
  {
    aliasFields: [['browser']],
    conditionNames: ['import', 'workerd', 'worker', 'browser', 'node', 'module', 'default'],
    name: 'workerd',
    mainFields: ['browser', 'module', 'main'],
  },
  {
    aliasFields: [['browser']],
    conditionNames: ['import', 'worker', 'browser', 'node', 'module', 'default'],
    name: 'worker',
    mainFields: ['browser', 'module', 'main'],
  },
]

async function bundleFor(target: NonNodeTarget): Promise<{
  builtins: string[]
  inputs: string[]
}> {
  const builtins = new Set<string>()
  const inputs = new Set<string>()
  const virtualEntry = resolve(packageDir, `.non-node-${target.name}.js`)
  const bundle = await rolldown({
    cwd: packageDir,
    input: virtualEntry,
    logLevel: 'silent',
    platform: 'neutral',
    plugins: [
      {
        name: 'record-non-node-bundle',
        resolveId(source, importer) {
          if (source === virtualEntry) return virtualEntry
          if (!isBuiltin(source)) return null

          builtins.add(`${source} from ${relative(packageDir, importer ?? virtualEntry)}`)
          return {external: true, id: source}
        },
        load(id) {
          if (id !== virtualEntry) return null
          return `import * as client from '@sanity/client'; export {client}`
        },
        moduleParsed(moduleInfo) {
          inputs.add(moduleInfo.id)
        },
      },
    ],
    resolve: {
      aliasFields: target.aliasFields,
      conditionNames: target.conditionNames,
      mainFields: target.mainFields,
    },
    treeshake: false,
  })

  try {
    await bundle.generate({format: 'esm'})
  } finally {
    await bundle.close()
  }

  return {
    builtins: [...builtins].sort(),
    inputs: [...inputs],
  }
}

describe('non-Node consumer bundles', () => {
  for (const target of nonNodeTargets) {
    test(`${target.name} resolves the fetch build with no Node built-ins`, async () => {
      const {builtins, inputs} = await bundleFor(target)

      expect(inputs).toContain(fetchEntry)
      expect(builtins).toEqual([])
    })
  }
})
