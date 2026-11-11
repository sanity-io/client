import process from 'node:process'

// React Native on Hermes can lack both globals. The client is imported
// dynamically so it is evaluated after they are removed.
delete globalThis.Event
delete globalThis.EventTarget

const {createClient} = await import(process.argv[2])

const client = createClient({
  projectId: 'abc123',
  dataset: 'production',
  apiVersion: '2025-01-01',
  useCdn: false,
})

if (typeof client.fetch !== 'function') {
  throw new Error('createClient() did not return a client')
}
