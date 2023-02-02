import type {FIXME} from '../types'

export default (fn: FIXME) => {
  let didCall = false
  let returnValue: FIXME
  return (...args: FIXME[]) => {
    if (didCall) {
      return returnValue
    }
    returnValue = fn(...args)
    didCall = true
    return returnValue
  }
}
