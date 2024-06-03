import type {Any} from '../types'

export function once(fn: Any) {
  let didCall = false
  let returnValue: Any
  return (...args: Any[]) => {
    if (didCall) {
      return returnValue
    }
    returnValue = fn(...args)
    didCall = true
    return returnValue
  }
}
