function AuthClient(client) {
  this.client = client
}

Object.assign(AuthClient.prototype, {
  getLoginProviders() {
    return this.client.request({uri: '/auth/providers'})
  },

  logout() {
    return this.client.request({uri: '/auth/logout', method: 'POST'})
  },
})

module.exports = AuthClient
