import { window } from 'vscode'
import { ProgressLocation } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { PrismaProjectItem } from '../PrismaPostgresTreeDataProvider'

export const deleteProject = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  if (!(args instanceof PrismaProjectItem)) throw new Error('Invalid arguments')

  const confirmDeleteResult = await window.showWarningMessage(
    `Are you sure you want to delete project '${args.projectName}'?`,
    { modal: true },
    { title: 'Delete' },
    { title: 'Cancel', isCloseAffordance: true },
  )

  if (confirmDeleteResult?.title !== 'Delete') return

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deleting project '${args.projectName}'...`,
    },
    () => ppgRepository.deleteProject({ workspaceId: args.workspaceId, id: args.projectId }),
  )

  ppgRepository.triggerRefresh()

  void window.showInformationMessage(`Project '${args.projectName}' deleted`)
}
