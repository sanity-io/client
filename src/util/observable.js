//  Since `@sanity/client` doesn't offer ESM exports (yet) const {filter} = require('rxjs/operators') will cause the the whole of rxjs to be included in the bundle.
//  The internal import paths here is a stop-gap measure and will become less of a problem when @sanity/client export tree-shakeable esm bundles
const {Observable} = require('rxjs/internal/Observable')
const {filter} = require('rxjs/internal/operators/filter')
const {map} = require('rxjs/internal/operators/map')

module.exports = {
  Observable,
  filter,
  map,
}
