import { env, type ExtensionContext, Uri } from 'vscode'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import path from 'path'
import { readFile } from 'fs/promises'
import getPort from 'get-port'
import { serve } from '@hono/node-server'
import { createAccelerateHttpClient } from '@prisma/studio-core-licensed/data/accelerate'
import { serializeError, type StudioBFFRequest } from '@prisma/studio-core-licensed/data/bff'
import { createPostgresJSExecutor } from '@prisma/studio-core-licensed/data/postgresjs'
import type { Executor } from '@prisma/studio-core-licensed/data'
import type { StudioProps } from '@prisma/studio-core-licensed/ui'
import type TelemetryReporter from '../../../../telemetryReporter'
import type { LaunchArg } from '../../../prisma-postgres-manager/commands/launchStudio'
import { isDebugOrTestSession } from '../../../../util'

/**
 * Prisma ORM specific query parameters that should be removed from the connection string
 * before passing it to the database client to avoid errors.
 */
const PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'sslidentity',
  'sslaccept',
  'pool', // Using connection pooling with `postgres` package is unable to connect to PPG. Disabling it for now by removing the param. See https://linear.app/prisma-company/issue/TML-1670.
  'socket_timeout',
  'pgbouncer',
  'statement_cache_size',
] as const

type DatabaseType = 'accelerate' | 'postgres'

interface DatabaseConfig {
  type: DatabaseType
  createExecutor: (connectionString: string) => Promise<Executor>
}

function getDatabaseConfig(dbUrl: string): DatabaseConfig | null {
  const protocol = new URL(dbUrl).protocol.replace(':', '')

  switch (protocol) {
    case 'prisma+postgres':
      return {
        type: 'accelerate',
        // eslint-disable-next-line @typescript-eslint/require-await
        async createExecutor(connectionString: string) {
          const url = new URL(connectionString)
          return createAccelerateHttpClient({
            host: url.host,
            apiKey: url.searchParams.get('api_key') ?? '',
            // TODO: these should be dynamic based on the vscode build
            engineHash: '9b628578b3b7cae625e8c927178f15a170e74a9c',
            clientVersion: '6.10.1',
            provider: 'postgres',
          })
        },
      }
    // TODO: postgres TCP protocol does not work for PPG Dev instances yet. We need to use the HTTP URL aka `prisma+postgres://` instead.
    // See https://linear.app/prisma-company/issue/TML-1670.
    case 'postgres':
    case 'postgresql':
      return {
        type: 'postgres',
        async createExecutor(connectionString: string) {
          const postgresModule = await import('postgres')
          const connectionURL = new URL(connectionString)

          for (const queryParameter of PRISMA_ORM_SPECIFIC_QUERY_PARAMETERS) {
            connectionURL.searchParams.delete(queryParameter)
          }

          const postgres = postgresModule.default(connectionURL.toString())
          return createPostgresJSExecutor(postgres)
        },
      }

    default:
      return null
  }
}

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

  const databaseConfig = getDatabaseConfig(dbUrl)
  if (!databaseConfig) {
    const protocol = URL.canParse(dbUrl) ? new URL(dbUrl).protocol.replace(':', '') : 'unknown'
    throw new Error(`Prisma Studio is not supported for the "${protocol}" protocol.`)
  }

  const executor = await databaseConfig.createExecutor(dbUrl)

  const staticFilesPath = ['dist', 'node_modules', '@prisma', 'studio-core-licensed']
  const staticFilesRoot = Uri.joinPath(context.extensionUri, ...staticFilesPath)

  const app = new Hono()

  app.use('*', cors())

  // BFF endpoint for database queries
  app.post('/bff', async (ctx) => {
    const request = await ctx.req.json<StudioBFFRequest>()

    const { procedure } = request

    if (procedure === 'query') {
      const [error, results] = await executor.execute(request.query)

      if (error) {
        return ctx.json([serializeError(error)])
      }

      return ctx.json([null, results])
    } else {
      return ctx.text('Unknown procedure', { status: 500 })
    }
  })

  const commonInformation = {
    databaseType: databaseConfig.type,
    protocol: URL.canParse(dbUrl) ? new URL(dbUrl).protocol.replace(':', '') : 'unknown',
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
            name: database.name,
            projectId: database.projectId,
            type: 'remote',
            workspaceId: database.workspaceId,
          },
    vscode: { machineId: env.machineId, sessionId: env.sessionId },
  }

  app.post('/telemetry', async (ctx) => {
    const { eventId, name, payload, timestamp } =
      await ctx.req.json<Parameters<NonNullable<StudioProps['onEvent']>>[0]>()

    if (isDebugOrTestSession() || name !== 'studio_launched') {
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
      .catch(() => {
        // noop
      })

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
