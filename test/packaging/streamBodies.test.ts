import {execFile} from 'node:child_process'
import {cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {promisify} from 'node:util'

import {test} from 'vitest'

import pkg from '../../package.json'

const exec = promisify(execFile)
const packageDir = resolve(__dirname, '../..')

// Source aliases hide export-map mistakes, and the development map can differ
// from the published one. Run actual consumers of the packed package.
const runtimes = [
  {name: 'Bun', command: 'bun', args: [], fixture: 'bun-streams.mjs'},
  // `sanity-function` and `react-server` resolve the fetch build on Node.js
  {name: 'Node', command: 'node', args: [], fixture: 'node-streams.mjs'},
  {
    name: 'Node sanity-function',
    command: 'node',
    args: ['--conditions=sanity-function'],
    fixture: 'node-streams.mjs',
  },
  {
    name: 'Node react-server',
    command: 'node',
    args: ['--conditions=react-server'],
    fixture: 'node-streams.mjs',
  },
  {
    name: 'Deno',
    command: 'deno',
    args: ['run', '--no-lock', '-A', '--deny-net', '--no-prompt', '--node-modules-dir=manual'],
    fixture: 'deno-streams.mjs',
  },
]

test.each(runtimes)(
  'the packed $name entry accepts Node stream request and upload bodies',
  async ({command, args, fixture}) => {
    const consumerDir = await mkdtemp(join(tmpdir(), 'sanity-client-streams-'))
    try {
      await exec(
        'pnpm',
        ['--config.ignore-scripts=true', 'pack', '--pack-destination', consumerDir],
        {
          cwd: packageDir,
        },
      )

      const installedPackageDir = join(consumerDir, 'node_modules/@sanity/client')
      await mkdir(installedPackageDir, {recursive: true})
      await exec('tar', [
        '-xzf',
        join(consumerDir, `sanity-client-${pkg.version}.tgz`),
        '-C',
        installedPackageDir,
        '--strip-components=1',
      ])

      // Reuse the installed production dependencies without reaching the network.
      for (const dependency of Object.keys(pkg.dependencies)) {
        const installedDependency = await realpath(join(packageDir, 'node_modules', dependency))
        const consumerDependency = join(consumerDir, 'node_modules', dependency)
        await symlink(installedDependency, consumerDependency, 'junction')
      }

      await writeFile(
        join(consumerDir, 'package.json'),
        JSON.stringify({
          type: 'module',
          dependencies: {'@sanity/client': pkg.version, ...pkg.dependencies},
        }),
      )
      await cp(join(packageDir, 'test/packaging/fixtures'), join(consumerDir, 'fixtures'), {
        recursive: true,
      })
      await exec(
        command,
        [
          ...args,
          join(consumerDir, 'fixtures', fixture),
          join(packageDir, 'test/fixtures/pdf-sample.pdf'),
        ],
        {
          cwd: consumerDir,
          env: {...process.env, DENO_DIR: join(consumerDir, 'deno-cache')},
        },
      )
    } finally {
      await rm(consumerDir, {recursive: true, force: true})
    }
  },
  30_000,
)
