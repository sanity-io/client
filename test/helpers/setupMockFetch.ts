// Registers the `get-it/vitest` custom matchers (toHaveReceivedRequest,
// toHaveHeader, toHaveBody, ...) on vitest's `expect`, including the type
// augmentation.
import 'get-it/vitest'
import {afterEach, beforeEach} from 'vitest'

import {installMock, uninstallMock} from './mockFetch'

beforeEach(() => {
  installMock()
})

afterEach(() => {
  uninstallMock()
})
