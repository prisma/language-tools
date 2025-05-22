import { ExtensionContext, ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { z } from 'zod'
import { launch } from '../../prisma-studio/commands/launch'

export const launchStudioForRemoteDatabase = async ({
  ppgRepository,
  context,
  args,
}: {
  ppgRepository: PrismaPostgresRepository
  context: ExtensionContext
  args: unknown
}) => {
  const database = z
    .object({
      workspaceId: z.string(),
      projectId: z.string(),
      databaseId: z.string(),
    })
    .parse(args)

  const connectionString = await getConnectionString(ppgRepository, database)

  if (!connectionString) return

  void launch({ dbUrl: connectionString, context })
}

const getConnectionString = async (
  ppgRepository: PrismaPostgresRepository,
  database: {
    workspaceId: string
    projectId: string
    databaseId: string
  },
) => {
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
