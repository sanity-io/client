import pkg from '../../package.json' with {type: 'json'}

const imports: Record<string, `https://esm.sh/${string}@${string}`> = {}

for (const [name, version] of Object.entries(pkg.dependencies)) {
  if (name.startsWith('@types/')) continue
  imports[name] = `https://esm.sh/${name}@${version}`
  // Sub-paths used by the browser bundle that aren't declared as standalone
  // dependencies in package.json
  if (name === 'get-it') {
    // get-it v9's exports map routes the `deno` condition to the Node entry,
    // which transitively pulls `undici` (and `node:sqlite`) — esm.sh can't
    // serve that to Deno. `?target=es2022` bypasses esm.sh's denonext
    // transform so we get the platform-neutral build instead, and
    // `?bundle-deps` collapses the transient package graph (still without
    // the Node entry) into a single file.
    imports[name] = `https://esm.sh/${name}@${version}/dist/index.js?bundle-deps&target=es2022`
    imports['get-it/middleware'] =
      `https://esm.sh/${name}@${version}/dist/middleware.js?bundle-deps&target=es2022`
  }
  if (name === 'rxjs') {
    imports['rxjs/operators'] = `https://esm.sh/${name}@${version}/operators`
  }
}

await Deno.writeTextFile(
  new URL('import_map.json', import.meta.url),
  JSON.stringify({imports}, null, 2),
)
