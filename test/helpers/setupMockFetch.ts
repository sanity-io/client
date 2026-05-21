import {afterEach, beforeEach} from 'vitest'

import {installMock, uninstallMock} from './nockShim'

beforeEach(() => {
  installMock()
})

afterEach(() => {
  uninstallMock()
})
