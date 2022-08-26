function ProjectsClient(client) {
  this.client = client
}

Object.assign(ProjectsClient.prototype, {
  list() {
    return this.client.request({uri: '/projects'})
  },

  getById(id) {
    return this.client.request({uri: `/projects/${id}`})
  },
})

export default ProjectsClient
