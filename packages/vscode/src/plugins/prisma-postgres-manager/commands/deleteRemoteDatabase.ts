import { ProgressLocation } from 'vscode'
import { window } from 'vscode'
import { isRemoteDatabase, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export const deleteRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  if (!isRemoteDatabase(args)) throw new Error('Invalid arguments')

  const confirmDeleteResult = await window.showWarningMessage(
    `Are you sure you want to delete database '${args.name}'?`,
    { modal: true },
    { title: 'Delete' },
    { title: 'Cancel', isCloseAffordance: true },
  )

  if (confirmDeleteResult?.title !== 'Delete') return

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deleting database...`,
    },
    () =>
      ppgRepository.deleteRemoteDatabase({
        workspaceId: args.workspaceId,
        projectId: args.projectId,
        id: args.id,
      }),
  )

  void window.showInformationMessage(`Database deleted`)
}
