import {type Observable} from 'rxjs'

import {_request} from '../../data/dataMethods'
import type {ObservableSanityClient, SanityClient} from '../../SanityClient'
import type {Any, GenerateInstruction, HttpRequest, IdentifiedSanityDocumentStub} from '../../types'
import {hasDataset} from '../../validators'

export function _generate<
  DocumentShape extends Record<string, Any>,
  Req extends GenerateInstruction<DocumentShape>,
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
    uri: `/agent/action/generate/${dataset}`,
    body: request,
  })
}
