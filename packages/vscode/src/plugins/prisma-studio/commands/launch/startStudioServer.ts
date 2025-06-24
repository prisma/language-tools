import { ExtensionContext, Uri } from 'vscode'
import { Hono } from 'hono'
import { cors } from 'hono/cors' // Import the cors middleware
import path from 'path'
import { readFile } from 'fs/promises'
import getPort from 'get-port'
import { serve } from '@hono/node-server'
import { createAccelerateHttpClient } from '@prisma/studio-core/data/accelerate'
import { serializeError } from '@prisma/studio-core/data/bff'
import { Query } from '@prisma/studio-core/data'

/**
 * Starts a local server for Prisma Studio and serves the UI files.
 * @param args - An object containing the static files root URI.
 * @returns The URL of the running server.
 */
export async function startStudioServer(args: { dbUrl: string; context: ExtensionContext }) {
  const { dbUrl, context } = args
  const staticFilesPath = ['node_modules', '@prisma', 'studio-core']
  const staticFilesRoot = Uri.joinPath(context.extensionUri, ...staticFilesPath)

  const app = new Hono()

  app.use('*', cors())

  // gives access to accelerate (and more soon) via bff client
  app.post('/bff', async (c) => {
    const { query } = (await c.req.json()) as unknown as { query: Query }

    const [error, results] = await createAccelerateHttpClient({
      host: new URL(dbUrl).host,
      apiKey: new URL(dbUrl).searchParams.get('api_key') ?? '',
      // TODO: these need to be dynamic based on the vscode build
      engineHash: "9b628578b3b7cae625e8c927178f15a170e74a9c",
      clientVersion: "6.10.1",
      provider: 'postgres',
    }).execute(query)

    if (error) {
      return c.json([serializeError(error)])
    }

    return c.json([null, results])
  })

  // gives access to client side rendering resources
  app.get('/*', async (c) => {
    const reqPath = c.req.path.substring(1)
    const filePath = path.join(staticFilesRoot.path, reqPath)
    const fileExt = path.extname(filePath).toLowerCase()

    const contentTypeMap: Record<string, string> = {
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    }

    const contentType = contentTypeMap[fileExt] ?? 'application/octet-stream'

    try {
      return c.body(await readFile(filePath), 200, { 'Content-Type': contentType })
    } catch (error) {
      return c.text('File not found', 404)
    }
  })

  const port = await getPort()
  const serverUrl = `http://localhost:${port}`

  const server = serve({ fetch: app.fetch, port, overrideGlobalObjects: false }, () => {
    console.log(`Studio server is running at ${serverUrl}`)
  })

  return { server, url: serverUrl }
}
