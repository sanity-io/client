import path from 'node:path'

// Node-only: real browsers can't resolve `node:path`. Only import this from a
// `*.node.test.ts` file.
export const fixture = (name: string) => path.join(__dirname, '..', 'fixtures', name)
