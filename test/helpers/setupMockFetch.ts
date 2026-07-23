// Registers the `get-it/vitest` custom matchers (toHaveReceivedRequest,
// toHaveHeader, toHaveBody, ...) on vitest's `expect`, including the type
// augmentation.
import 'get-it/vitest'

import {afterEach, beforeEach} from 'vitest'

import {installMock, uninstallMock} from './mockFetch'

// In the simulated browser env (happy-dom), `XMLHttpRequest` is available
// and `client.assets.upload()` routes through it for progress events.
// happy-dom's XHR talks to the real network, which the mock fetch can't
// intercept — so we hide `XMLHttpRequest` for the duration of the test so
// uploads fall back to the fetch path the mock can see. Real-browser
// validation of the XHR upload path needs to happen elsewhere.
const xhrEnv = globalThis as {XMLHttpRequest?: unknown}
const originalXMLHttpRequest = xhrEnv.XMLHttpRequest

beforeEach(() => {
  if (originalXMLHttpRequest !== undefined) {
    delete xhrEnv.XMLHttpRequest
  }
  installMock()
})

afterEach(() => {
  uninstallMock()
  if (originalXMLHttpRequest !== undefined) {
    xhrEnv.XMLHttpRequest = originalXMLHttpRequest
  }
})
