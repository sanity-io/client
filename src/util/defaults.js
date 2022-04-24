// eslint-disable-next-line no-shadow
export const defaults = (obj, defaults) =>
  Object.keys(defaults)
    .concat(Object.keys(obj))
    .reduce((target, prop) => {
      target[prop] = typeof obj[prop] === 'undefined' ? defaults[prop] : obj[prop]

      return target
    }, {})
