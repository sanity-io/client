import {defer, shareReplay} from 'rxjs'
import {map} from 'rxjs/operators'

export const eventSourcePolyfill = defer(() => import('@sanity/eventsource')).pipe(
  map(({default: EventSource}) => EventSource as unknown as typeof globalThis.EventSource),
  shareReplay(1),
)
