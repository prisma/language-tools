import { env, type ExtensionContext, Uri } from 'vscode'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import path from 'path'
import { readFile } from 'fs/promises'
import getPort from 'get-port'
import { serve } from '@hono/node-server'
import { createAccelerateHttpClient } from '@prisma/studio-core-licensed/data/accelerate'
import { serializeError } from '@prisma/studio-core-licensed/data/bff'
import type { Query } from '@prisma/studio-core-licensed/data'
import type { StudioProps } from '@prisma/studio-core-licensed/ui'
import type TelemetryReporter from '../../../../telemetryReporter'
import type { LaunchArg } from '../../../prisma-postgres-manager/commands/launchStudio'

export interface StartStudioServerArgs {
  context: ExtensionContext
  database?: LaunchArg
  dbUrl: string
  telemetryReporter: TelemetryReporter
}

/**
 * Starts a local server for Prisma Studio and serves the UI files.
 * @param args - An object containing the static files root URI.
 * @returns The URL of the running server.
 */
export async function startStudioServer(args: StartStudioServerArgs) {
  const { database, dbUrl, context, telemetryReporter } = args

  const staticFilesPath = ['node_modules', '@prisma', 'studio-core-licensed']
  const staticFilesRoot = Uri.joinPath(context.extensionUri, ...staticFilesPath)

  const app = new Hono()

  app.use('*', cors())

  // gives access to accelerate (and more soon) via bff client
  app.post('/bff', async (ctx) => {
    const { query } = (await ctx.req.json()) as unknown as { query: Query }

    const [error, results] = await createAccelerateHttpClient({
      host: new URL(dbUrl).host,
      apiKey: new URL(dbUrl).searchParams.get('api_key') ?? '',
      // TODO: these need to be dynamic based on the vscode build
      engineHash: '9b628578b3b7cae625e8c927178f15a170e74a9c',
      clientVersion: '6.10.1',
      provider: 'postgres',
    }).execute(query)

    if (error) {
      return ctx.json([serializeError(error)])
    }

    return ctx.json([null, results])
  })

  const commonInformation = {
    ppg: !database
      ? {
          databaseId: null,
          name: null,
          projectId: null,
          type: dbUrl.includes('localhost') ? 'local' : 'remote',
          workspaceId: null,
        }
      : database.type === 'local'
        ? {
            databaseId: null,
            name: database.name,
            projectId: null,
            type: 'local',
            workspaceId: null,
          }
        : {
            databaseId: database.databaseId,
            name: null,
            projectId: database.projectId,
            type: 'remote',
            workspaceId: database.workspaceId,
          },
    vscode: { machineId: env.machineId, sessionId: env.sessionId },
  }

  app.post('/telemetry', async (ctx) => {
    const { eventId, name, payload, timestamp } =
      await ctx.req.json<Parameters<NonNullable<StudioProps['onEvent']>>[0]>()

    if (name !== 'studio_launched') {
      return ctx.body(null, 204)
    }

    void telemetryReporter
      .sendTelemetryEvent({
        check_if_update_available: false,
        client_event_id: eventId,
        command: name,
        information: JSON.stringify({ ...commonInformation, eventPayload: payload }),
        local_timestamp: timestamp,
      })
      .catch(() => {})

    return ctx.body(null, 204)
  })

  // gives access to client side rendering resources
  app.get('/*', async (ctx) => {
    const reqPath = ctx.req.path.substring(1)
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
      return ctx.body(await readFile(filePath), 200, { 'Content-Type': contentType })
    } catch (error) {
      return ctx.text('File not found', 404)
    }
  })

  const port = await getPort()
  const serverUrl = `http://localhost:${port}`

  const server = serve({ fetch: app.fetch, port, overrideGlobalObjects: false }, () => {
    console.log(`Studio server is running at ${serverUrl}`)
  })

  return { server, url: serverUrl }
}
