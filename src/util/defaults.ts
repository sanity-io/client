import type {Any} from '../types'

export default (obj: Any, defaults: Any) =>
  Object.keys(defaults)
    .concat(Object.keys(obj))
    .reduce((target, prop) => {
      target[prop] = typeof obj[prop] === 'undefined' ? defaults[prop] : obj[prop]

      return target
    }, {} as Any)
