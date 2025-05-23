import { ProgressLocation, window } from 'vscode'
import { isRemoteDatabase, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'

export const getRemoteDatabaseConnectionString = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  if (!isRemoteDatabase(args)) throw new Error('Invalid arguments')

  const connectionString = await ppgRepository.getStoredRemoteDatabaseConnectionString({
    workspaceId: args.workspaceId,
    projectId: args.projectId,
    databaseId: args.id,
  })

  if (connectionString) {
    void presentConnectionString({
      connectionString,
      type: 'connectionStringDisplay',
    })
    return
  }

  const result = await window.showInformationMessage(
    `Create Connection String`,
    {
      detail: `No locally stored connection string found for remote database ${args.name}.\n\nDo you want to create a new connection string?`,
      modal: true,
    },
    { id: 'create', title: 'Create connection string', isCloseAffordance: false },
    { id: 'cancel', title: 'Cancel', isCloseAffordance: true },
  )

  if (result?.id === 'cancel') return

  const createdConnectionString = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating connection string...`,
    },
    () =>
      ppgRepository.createRemoteDatabaseConnectionString({
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        databaseId: args.id,
      }),
  )

  void presentConnectionString({
    connectionString: createdConnectionString,
    type: 'connectionStringCreated',
  })
}
