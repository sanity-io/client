import {readFileSync} from 'node:fs'
import {createServer, type IncomingMessage, type Server} from 'node:http'
import type {AddressInfo, Socket} from 'node:net'
import {join as joinPath} from 'node:path'
import {TLSSocket} from 'node:tls'

// Load pre-generated test certificates
const testCert = {
  key: readFileSync(joinPath(__dirname, 'certs', 'key.pem')),
  cert: readFileSync(joinPath(__dirname, 'certs', 'cert.pem')),
}

import {createClient} from '@sanity/client'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'

import {requestOptions} from '../src/http/requestOptions'

describe.skipIf(typeof EdgeRuntime === 'string' || typeof document !== 'undefined')(
  'proxy configuration',
  () => {
    describe('requestOptions', () => {
      test('passes proxy from config to request options', () => {
        const config = {
          projectId: 'abc123',
          dataset: 'production',
          proxy: 'http://proxy.example.com:8080',
        }
        const options = requestOptions(config)
        expect(options.proxy).toBe('http://proxy.example.com:8080')
      })

      test('passes proxy from overrides to request options', () => {
        const config = {
          projectId: 'abc123',
          dataset: 'production',
        }
        const overrides = {
          proxy: 'http://override-proxy.example.com:8080',
        }
        const options = requestOptions(config, overrides)
        expect(options.proxy).toBe('http://override-proxy.example.com:8080')
      })

      test('overrides proxy takes precedence over config proxy', () => {
        const config = {
          projectId: 'abc123',
          dataset: 'production',
          proxy: 'http://config-proxy.example.com:8080',
        }
        const overrides = {
          proxy: 'http://override-proxy.example.com:9090',
        }
        const options = requestOptions(config, overrides)
        expect(options.proxy).toBe('http://override-proxy.example.com:9090')
      })

      test('proxy is undefined when not specified', () => {
        const config = {
          projectId: 'abc123',
          dataset: 'production',
        }
        const options = requestOptions(config)
        expect(options.proxy).toBeUndefined()
      })
    })

    describe('client configuration', () => {
      test('can set proxy in client config', () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          proxy: 'http://proxy.example.com:8080',
        })
        expect(client.config().proxy).toBe('http://proxy.example.com:8080')
      })

      test('can update proxy via config()', () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
        })
        client.config({proxy: 'http://new-proxy.example.com:8080'})
        expect(client.config().proxy).toBe('http://new-proxy.example.com:8080')
      })

      test('withConfig preserves proxy setting', () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          proxy: 'http://proxy.example.com:8080',
        })
        const newClient = client.withConfig({dataset: 'staging'})
        expect(newClient.config().proxy).toBe('http://proxy.example.com:8080')
      })

      test('withConfig can override proxy setting', () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          proxy: 'http://proxy.example.com:8080',
        })
        const newClient = client.withConfig({proxy: 'http://new-proxy.example.com:9090'})
        expect(newClient.config().proxy).toBe('http://new-proxy.example.com:9090')
      })
    })

    describe('proxy server integration', () => {
      let proxyServer: Server
      let proxyPort: number
      let connectRequests: {method: string; url: string; headers: IncomingMessage['headers']}[]
      let tunneledRequests: {method: string; url: string; headers: Record<string, string>}[]
      let originalTlsReject: string | undefined

      beforeEach(async () => {
        // Allow self-signed certificates for testing
        originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        connectRequests = []
        tunneledRequests = []

        // Create a mock HTTP proxy server that handles CONNECT for HTTPS tunneling
        proxyServer = createServer()

        // Handle CONNECT method for HTTPS tunneling
        proxyServer.on('connect', (req: IncomingMessage, clientSocket: Socket) => {
          connectRequests.push({
            method: req.method || 'CONNECT',
            url: req.url || '',
            headers: req.headers,
          })

          // Tell the client the tunnel is established
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

          // Create a TLS server to handle the tunneled HTTPS request
          const tlsSocket = new TLSSocket(clientSocket, {
            isServer: true,
            key: testCert.key,
            cert: testCert.cert,
          })

          // Buffer to accumulate request data
          let requestData = ''

          tlsSocket.on('data', (data: Buffer) => {
            requestData += data.toString()

            // Check if we have a complete HTTP request (ends with double CRLF)
            if (requestData.includes('\r\n\r\n')) {
              // Parse the HTTP request
              const lines = requestData.split('\r\n')
              const [method, path] = lines[0].split(' ')
              const headers: Record<string, string> = {}

              for (let i = 1; i < lines.length; i++) {
                const line = lines[i]
                if (line === '') break
                const colonIndex = line.indexOf(':')
                if (colonIndex > 0) {
                  const key = line.substring(0, colonIndex).toLowerCase()
                  const value = line.substring(colonIndex + 1).trim()
                  headers[key] = value
                }
              }

              tunneledRequests.push({
                method,
                url: `https://${req.url}${path}`,
                headers,
              })

              // Send a mock Sanity API response
              const responseBody = JSON.stringify({result: []})
              const response = [
                'HTTP/1.1 200 OK',
                'Content-Type: application/json',
                `Content-Length: ${responseBody.length}`,
                'Connection: close',
                '',
                responseBody,
              ].join('\r\n')

              tlsSocket.write(response)
              tlsSocket.end()
            }
          })

          tlsSocket.on('error', () => {
            // Ignore TLS errors in tests
          })
        })

        await new Promise<void>((resolve) => {
          proxyServer.listen(0, '127.0.0.1', () => {
            proxyPort = (proxyServer.address() as AddressInfo).port
            resolve()
          })
        })
      })

      afterEach(async () => {
        // Restore original TLS setting
        if (originalTlsReject === undefined) {
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
        } else {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
        }
        await new Promise<void>((resolve) => proxyServer.close(() => resolve()))
      })

      test('fetch() routes through proxy to project hostname', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          proxy: `http://127.0.0.1:${proxyPort}`,
        })

        await client.fetch('*[_type == "post"]')

        expect(connectRequests.length).toBe(1)
        expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].url).toContain('/v2021-06-07/data/query/production')
      })

      test('fetch() routes through proxy to CDN hostname when useCdn is true', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: true,
          proxy: `http://127.0.0.1:${proxyPort}`,
        })

        await client.fetch('*[_type == "post"]')

        expect(connectRequests.length).toBe(1)
        expect(connectRequests[0].url).toBe('abc123.apicdn.sanity.io:443')
        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].url).toContain('/v2021-06-07/data/query/production')
      })

      test('users.getById() routes through proxy to project hostname', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          proxy: `http://127.0.0.1:${proxyPort}`,
        })

        await client.users.getById('me')

        expect(connectRequests.length).toBe(1)
        expect(connectRequests[0].url).toBe('abc123.api.sanity.io:443')
        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].url).toContain('/v2021-06-07/users/me')
      })

      test('routes through proxy to global API when useProjectHostname is false', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          useProjectHostname: false,
          proxy: `http://127.0.0.1:${proxyPort}`,
        })

        await client.users.getById('me')

        expect(connectRequests.length).toBe(1)
        expect(connectRequests[0].url).toBe('api.sanity.io:443')
        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].url).toContain('/v2021-06-07/users/me')
      })

      test('proxy receives authorization header when token is set', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          proxy: `http://127.0.0.1:${proxyPort}`,
          token: 'test-token',
        })

        await client.fetch('*[_type == "post"]')

        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].headers.authorization).toBe('Bearer test-token')
      })

      test('proxy receives project ID header when useProjectHostname is false', async () => {
        const client = createClient({
          projectId: 'abc123',
          dataset: 'production',
          apiVersion: '2021-06-07',
          useCdn: false,
          useProjectHostname: false,
          proxy: `http://127.0.0.1:${proxyPort}`,
        })

        await client.users.getById('me')

        expect(tunneledRequests.length).toBe(1)
        expect(tunneledRequests[0].headers['x-sanity-project-id']).toBe('abc123')
      })
    })
  },
)
