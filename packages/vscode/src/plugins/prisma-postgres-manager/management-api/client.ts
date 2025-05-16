import createClient from 'openapi-fetch'
import type { paths } from './api'

class FetchError extends Error {
  constructor() {
    super('Connection to API failed.')
  }
}

export const createManagementAPIClient = (token: string) => {
  const client = createClient<paths>({ baseUrl: 'https://api.prisma.io' })
  client.use({
    onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${token}`)
      console.log('onRequest', {
        method: request.method,
        url: request.url,
        body: request.body,
      })
      return request
    },
    onResponse({ response }) {
      console.log('onResponse', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      })
      return response
    },
    onError({ error }) {
      console.error('Fetch error', error)
      return new FetchError()
    },
  })

  return client
}
