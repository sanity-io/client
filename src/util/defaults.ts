import type {FIXME} from '../types'

export default (obj: FIXME, defaults: FIXME) =>
  Object.keys(defaults)
    .concat(Object.keys(obj))
    .reduce((target, prop) => {
      target[prop] = typeof obj[prop] === 'undefined' ? defaults[prop] : obj[prop]

      return target
    }, {} as FIXME)
