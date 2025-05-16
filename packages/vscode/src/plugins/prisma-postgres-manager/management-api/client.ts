import createClient from 'openapi-fetch'
import type { paths } from './api'

export const getClient = (token: string) => {
  const client = createClient<paths>({ baseUrl: 'https://api.prisma.io' })
  client.use({
    onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${token}`)
      return request
    },
  })

  return client
}
