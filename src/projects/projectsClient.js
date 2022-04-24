export class ProjectsClient {
  constructor(client) {
    this.client = client
  }

  list() {
    return this.client.request({uri: '/projects'})
  }

  getById(id) {
    return this.client.request({uri: `/projects/${id}`})
  }
}
