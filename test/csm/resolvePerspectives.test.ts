import {expect, test} from 'vitest'

import {resolvePerspectives} from '../../src/csm/resolvePerspectives'

test.each([
  ['previewDrafts', ['drafts', 'published']],
  ['drafts', ['drafts', 'published']],
  ['published', ['published']],
  [['drafts'], ['drafts', 'published']],
  [['published'], ['published']],
  [['rABC123'], ['rABC123', 'published']],
  [
    ['rABC123', 'drafts'],
    ['rABC123', 'drafts', 'published'],
  ],
  [
    ['rABC123', 'drafts', 'published'],
    ['rABC123', 'drafts', 'published'],
  ],
])('resolvePerspectives(%s)', (perspective, shouldEqual) => {
  expect(resolvePerspectives(perspective as unknown as any)).toEqual(shouldEqual)
})
