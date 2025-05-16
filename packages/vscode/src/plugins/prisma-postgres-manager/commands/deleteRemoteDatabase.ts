import { ProgressLocation } from 'vscode'
import { window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { PrismaRemoteDatabaseItem } from '../PrismaPostgresTreeDataProvider'

export const deleteRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  if (!(args instanceof PrismaRemoteDatabaseItem)) throw new Error('Invalid arguments')

  const confirmDeleteResult = await window.showWarningMessage(
    `Are you sure you want to delete database '${args.databaseName}'?`,
    { modal: true },
    { title: 'Delete' },
    { title: 'Cancel', isCloseAffordance: true },
  )

  if (confirmDeleteResult?.title !== 'Delete') return

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deleting database '${args.databaseName}'...`,
    },
    () =>
      ppgRepository.deleteRemoteDatabase({
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        id: args.databaseId,
      }),
  )

  ppgRepository.triggerRefresh()

  void window.showInformationMessage(`Database '${args.databaseName}' deleted`)
}
