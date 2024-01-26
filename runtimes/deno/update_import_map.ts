import pkg from '../../package.json' assert {type: 'json'}

const imports: Record<string, `https://esm.sh/${string}@${string}`> = {}

for (const [name, version] of Object.entries(pkg.dependencies)) {
  if (name.startsWith('@types/')) continue
  imports[name] = `https://esm.sh/${name}@${version}`
  // Force the browser version of event source
  if (name === '@sanity/eventsource') {
    imports[name] = `${imports[name]}/browser`
  }
  // Handle known import paths that isn't declared as a dependency
  if (name === 'get-it') {
    imports['get-it/middleware'] = `https://esm.sh/${name}@${version}/middleware`
  }
  if (name === 'rxjs') {
    imports['rxjs/operators'] = `https://esm.sh/${name}@${version}/operators`
  }
}

await Deno.writeTextFile(
  new URL('import_map.json', import.meta.url),
  JSON.stringify({imports}, null, 2),
)
