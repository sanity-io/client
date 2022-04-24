import {Observable, map, filter} from './util/observable'
import {Patch} from './data/patch'
import {Transaction} from './data/transaction'
import {dataMethods} from './data/dataMethods'
import {DatasetsClient} from './datasets/datasetsClient'
import {ProjectsClient} from './projects/projectsClient'
import {AssetsClient} from './assets/assetsClient'
import {UsersClient} from './users/usersClient'
import {AuthClient} from './auth/authClient'
import {httpRequest} from './http/request'
import {requestOptions} from './http/requestOptions'
import {defaultConfig, initConfig} from './config'
import * as validate from './validators'

const toPromise = (observable) => observable.toPromise()

export class SanityClient {
  constructor(config = defaultConfig) {
    this.config(config)

    this.assets = new AssetsClient(this)
    this.datasets = new DatasetsClient(this)
    this.projects = new ProjectsClient(this)
    this.users = new UsersClient(this)
    this.auth = new AuthClient(this)

    if (this.clientConfig.isPromiseAPI) {
      const observableConfig = Object.assign({}, this.clientConfig, {isPromiseAPI: false})
      this.observable = new SanityClient(observableConfig)
    }
  }

  clone() {
    return new SanityClient(this.config())
  }

  config(newConfig) {
    if (typeof newConfig === 'undefined') {
      return Object.assign({}, this.clientConfig)
    }

    if (this.observable) {
      const observableConfig = Object.assign({}, newConfig, {isPromiseAPI: false})
      this.observable.config(observableConfig)
    }

    this.clientConfig = initConfig(newConfig, this.clientConfig || {})
    return this
  }

  withConfig(newConfig) {
    return this.clone().config(newConfig)
  }

  getUrl(uri, useCdn = false) {
    const base = useCdn ? this.clientConfig.cdnUrl : this.clientConfig.url
    return `${base}/${uri.replace(/^\//, '')}`
  }

  isPromiseAPI() {
    return this.clientConfig.isPromiseAPI
  }

  _requestObservable(options) {
    const uri = options.url || options.uri

    // If the `canUseCdn`-option is not set we detect it automatically based on the method + URL.
    // Only the /data endpoint is currently available through API-CDN.
    const canUseCdn =
      typeof options.canUseCdn === 'undefined'
        ? ['GET', 'HEAD'].indexOf(options.method || 'GET') >= 0 && uri.indexOf('/data/') === 0
        : options.canUseCdn

    const useCdn = this.clientConfig.useCdn && canUseCdn

    const tag =
      options.tag && this.clientConfig.requestTagPrefix
        ? [this.clientConfig.requestTagPrefix, options.tag].join('.')
        : options.tag || this.clientConfig.requestTagPrefix

    if (tag) {
      options.query = {tag: validate.requestTag(tag), ...options.query}
    }

    const reqOptions = requestOptions(
      this.clientConfig,
      Object.assign({}, options, {
        url: this.getUrl(uri, useCdn),
      })
    )

    return new Observable((subscriber) =>
      httpRequest(reqOptions, this.clientConfig.requester).subscribe(subscriber)
    )
  }

  request(options) {
    const observable = this._requestObservable(options).pipe(
      filter((event) => event.type === 'response'),
      map((event) => event.body)
    )

    return this.isPromiseAPI() ? toPromise(observable) : observable
  }
}

Object.assign(SanityClient.prototype, dataMethods)

SanityClient.Patch = Patch
SanityClient.Transaction = Transaction
SanityClient.ClientError = httpRequest.ClientError
SanityClient.ServerError = httpRequest.ServerError
SanityClient.requester = httpRequest.defaultRequester

// Not using default exports is intentional, as it permits importing from both ESM and CJS node envs with less hazards
// https://nodejs.org/docs/latest/api/packages.html#writing-dual-packages-while-avoiding-or-minimizing-hazards
export function createClient(config) {
  return new SanityClient(config)
}
createClient.Patch = Patch
createClient.Transaction = Transaction
createClient.ClientError = httpRequest.ClientError
createClient.ServerError = httpRequest.ServerError
createClient.requester = httpRequest.defaultRequester
