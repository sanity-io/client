import type {MutationSelection} from '../types'

export function getSelection(sel: unknown): MutationSelection {
  if (typeof sel === 'string' || Array.isArray(sel)) {
    return {id: sel}
  }

  if (typeof sel === 'object' && sel !== null && 'query' in sel && typeof sel.query === 'string') {
    return 'params' in sel && typeof sel.params === 'object' && sel.params !== null
      ? {query: sel.query, params: sel.params}
      : {query: sel.query}
  }

  const selectionOpts = [
    '* Document ID (<docId>)',
    '* Array of document IDs',
    '* Object containing `query`',
  ].join('\n')

  throw new Error(`Unknown selection - must be one of:\n\n${selectionOpts}`)
}
