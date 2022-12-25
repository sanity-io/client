//  Since `@sanity/client` doesn't offer ESM exports (yet) const {filter} = require('rxjs/operators') will cause the the whole of rxjs to be included in the bundle.
//  The internal import paths here is a stop-gap measure and will become less of a problem when @sanity/client export tree-shakeable esm bundles
import {Observable} from 'rxjs/internal/Observable'
import {filter} from 'rxjs/internal/operators/filter'
import {map} from 'rxjs/internal/operators/map'

export {Observable, filter, map}
