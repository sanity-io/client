import {type Observable} from 'rxjs'

import {_request} from '../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../SanityClient'
import type {Any, HttpRequest, IdentifiedSanityDocumentStub, InstructInstruction} from '../types'
import {hasDataset} from '../validators'

export function _instruct<
  DocumentShape extends Record<string, Any>,
  Req extends InstructInstruction<DocumentShape>,
>(
  client: SanityClient | ObservableSanityClient,
  httpRequest: HttpRequest,
  request: Req,
): Observable<
  Req['async'] extends true ? {_id: string} : IdentifiedSanityDocumentStub & DocumentShape
> {
  const dataset = hasDataset(client.config())
  return _request(client, httpRequest, {
    method: 'POST',
    uri: `/instruct/${dataset}`,
    body: request,
  })
}
