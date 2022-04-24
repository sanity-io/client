import * as validate from '../validators'

export class DatasetsClient {
  constructor(client) {
    this.request = client.request.bind(client)
  }

  create(name, options) {
    return this._modify('PUT', name, options)
  }

  edit(name, options) {
    return this._modify('PATCH', name, options)
  }

  delete(name) {
    return this._modify('DELETE', name)
  }

  list() {
    return this.request({uri: '/datasets'})
  }

  _modify(method, name, body) {
    validate.dataset(name)
    return this.request({method, uri: `/datasets/${name}`, body})
  }
}
