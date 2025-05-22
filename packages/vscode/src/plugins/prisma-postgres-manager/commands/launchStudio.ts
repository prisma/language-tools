import { ExtensionContext, ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { z } from 'zod'
import { launch } from '../../prisma-studio/commands/launch'

const LaunchArgSchema = z.union([
  z.object({
    type: z.literal('local'),
  }),
  z.object({
    type: z.literal('remote'),
    workspaceId: z.string(),
    projectId: z.string(),
    databaseId: z.string(),
  }),
])
type LaunchArg = z.infer<typeof LaunchArgSchema>

const DEFAULT_LOCAL_CONNECTION_STRING =
  'prisma+postgres://localhost:51213/?api_key=eyJkYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE0L3Bvc3RncmVzP2Nvbm5lY3Rpb25fbGltaXQ9MSZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc29ja2V0X3RpbWVvdXQ9MCZzc2xtb2RlPWRpc2FibGUiLCJzaGFkb3dEYXRhYmFzZVVybCI6InBvc3RncmVzOi8vcG9zdGdyZXM6cG9zdGdyZXNAbG9jYWxob3N0OjUxMjE1L3Bvc3RncmVzP2Nvbm5lY3Rpb25fbGltaXQ9MSZjb25uZWN0X3RpbWVvdXQ9MCZtYXhfaWRsZV9jb25uZWN0aW9uX2xpZmV0aW1lPTAmcG9vbF90aW1lb3V0PTAmc29ja2V0X3RpbWVvdXQ9MCZzc2xtb2RlPWRpc2FibGUifQ'

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

  const connectionString = await getConnectionString(ppgRepository, database)

  if (!connectionString) return

  void launch({ dbUrl: connectionString, context })
}

const getConnectionString = async (ppgRepository: PrismaPostgresRepository, database: LaunchArg) => {
  if (database.type === 'local') return DEFAULT_LOCAL_CONNECTION_STRING

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
      title: `Creating connection string for database...`,
    },
    () => ppgRepository.createRemoteDatabaseConnectionString(database),
  )

  return createdConnectionString
}
