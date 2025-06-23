import { ExtensionContext, ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { z } from 'zod'
import { launch } from '../../prisma-studio/commands/launch'

export const LaunchArgLocalSchema = z.object({
  type: z.literal('local'),
  id: z.string(),
  name: z.string(),
})
export type LaunchArgLocal = z.infer<typeof LaunchArgLocalSchema>

export const LaunchArgRemoteSchema = z.object({
  type: z.literal('remote'),
  workspaceId: z.string(),
  projectId: z.string(),
  databaseId: z.string(),
})
export type LaunchArgRemote = z.infer<typeof LaunchArgRemoteSchema>

const LaunchArgSchema = z.union([LaunchArgLocalSchema, LaunchArgRemoteSchema])
type LaunchArg = z.infer<typeof LaunchArgSchema>

export const launchStudio = async ({
  ppgRepository,
  context,
  args,
}: {
  ppgRepository: PrismaPostgresRepository
  context: ExtensionContext
  args: unknown
}) => {
  const database = LaunchArgSchema.parse(args)

  if (database.type === 'local') {
    await ppgRepository.createOrStartLocalDatabase(database)
  }

  const connectionString = await getConnectionString(ppgRepository, database)

  if (!connectionString) return

  void launch({ dbUrl: connectionString, context })
}

const getConnectionString = async (ppgRepository: PrismaPostgresRepository, database: LaunchArg) => {
  if (database.type === 'local') {
    return await ppgRepository.getLocalDatabaseConnectionString(database)
  }

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
