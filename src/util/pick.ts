import {type Any} from '../types'

export const pick = (obj: Any, props: Any) =>
  props.reduce((selection: Any, prop: Any) => {
    if (typeof obj[prop] === 'undefined') {
      return selection
    }

    selection[prop] = obj[prop]
    return selection
  }, {})
