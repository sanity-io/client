export class AuthClient {
  constructor(client) {
    this.client = client
  }

  getLoginProviders() {
    return this.client.request({uri: '/auth/providers'})
  }

  logout() {
    return this.client.request({uri: '/auth/logout', method: 'POST'})
  }
}
