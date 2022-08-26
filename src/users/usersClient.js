function UsersClient(client) {
  this.client = client
}

Object.assign(UsersClient.prototype, {
  getById(id) {
    return this.client.request({uri: `/users/${id}`})
  },
})

export default UsersClient
