import {execFile} from 'node:child_process'
import {cp, mkdir, mkdtemp, realpath, rm, symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {promisify} from 'node:util'

import {test} from 'vitest'

import pkg from '../../package.json'

const exec = promisify(execFile)
const packageDir = resolve(__dirname, '../..')

// Source aliases hide export-map mistakes, and the development map can differ
// from the published one. Run an actual Bun consumer of the packed package.
test('the packed Bun entry accepts Node stream request and upload bodies', async () => {
  const consumerDir = await mkdtemp(join(tmpdir(), 'sanity-client-bun-'))
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

    const fixture = join(consumerDir, 'bun-streams.mjs')
    await cp(join(packageDir, 'test/packaging/fixtures/bun-streams.mjs'), fixture)
    await exec('bun', [fixture, join(packageDir, 'test/fixtures/pdf-sample.pdf')], {
      cwd: consumerDir,
    })
  } finally {
    await rm(consumerDir, {recursive: true, force: true})
  }
}, 30_000)
