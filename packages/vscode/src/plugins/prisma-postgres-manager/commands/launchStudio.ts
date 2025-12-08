import { ExtensionContext, ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { z } from 'zod'
import { launch } from '../../prisma-studio/commands/launch'
import { PrismaDevRepository } from '../PrismaDevRepository'

export const LaunchArgLocalSchema = z.object({
  type: z.literal('local'),
  name: z.string(),
})
export type LaunchArgLocal = z.infer<typeof LaunchArgLocalSchema>

export const LaunchArgRemoteSchema = z.object({
  type: z.literal('remote'),
  workspaceId: z.string(),
  projectId: z.string(),
  databaseId: z.string(),
  name: z.string(),
})
export type LaunchArgRemote = z.infer<typeof LaunchArgRemoteSchema>

const LaunchArgSchema = z.union([LaunchArgLocalSchema, LaunchArgRemoteSchema])
export type LaunchArg = z.infer<typeof LaunchArgSchema>

export async function launchStudio({
  args,
  context,
  ppgRepository,
  prismaDevRepository,
}: {
  args: unknown
  context: ExtensionContext
  ppgRepository: PrismaPostgresRepository
  prismaDevRepository: PrismaDevRepository
}): Promise<void> {
  const database = LaunchArgSchema.parse(args)

  if (database.type === 'local') {
    await prismaDevRepository.startInstance(database)

    // TODO: There is currently an issue of connecting Studio to a PPG Dev instance via regular `postgres://` TCP urls.
    // This is a temporary workaround to use the HTTP aka `prisma+postgres://` URL instead.
    // See https://linear.app/prisma-company/issue/TML-1670.
    const connectionString = await prismaDevRepository.getInstanceConnectionString({
      name: database.name,
      type: 'http',
    })

    return void (await launch({ database, dbUrl: connectionString, context }))
  }

  const connectionString = await getConnectionString(ppgRepository, database)

  if (!connectionString) {
    return
  }

  await launch({ database, dbUrl: connectionString, context })
}

async function getConnectionString(
  ppgRepository: PrismaPostgresRepository,
  database: Exclude<LaunchArg, { type: 'local' }>,
) {
  const connectionString = await ppgRepository.getStoredRemoteDatabaseConnectionString(database)

  if (connectionString) return connectionString

  const result = await window.showInformationMessage(
    `Create Connection String`,
    {
      detail: `To open Studio with this database a connection string is required but no locally stored connection string was found.\n\nDo you want to create a new connection string?`,
      modal: true,
    },
    { id: 'create', title: 'Create connection string', isCloseAffordance: false },
    { id: 'cancel', title: 'Cancel', isCloseAffordance: true },
  )

  if (result?.id !== 'create') return undefined

  const createdConnectionString = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating connection string...`,
    },
    () => ppgRepository.createRemoteDatabaseConnectionString(database),
  )

  return createdConnectionString
}
