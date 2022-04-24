export class UsersClient {
  constructor(client) {
    this.client = client
  }

  getById(id) {
    return this.client.request({uri: `/users/${id}`})
  }
}
