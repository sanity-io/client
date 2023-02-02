import {FIXME} from '../types'

export default (obj: FIXME, props: FIXME) =>
  props.reduce((selection: FIXME, prop: FIXME) => {
    if (typeof obj[prop] === 'undefined') {
      return selection
    }

    selection[prop] = obj[prop]
    return selection
  }, {})
