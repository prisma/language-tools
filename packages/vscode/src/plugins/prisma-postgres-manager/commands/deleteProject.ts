import { window } from 'vscode'
import { ProgressLocation } from 'vscode'
import { isProject, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export const deleteProject = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  if (!isProject(args)) throw new Error('Invalid arguments')

  const confirmDeleteResult = await window.showWarningMessage(
    `Are you sure you want to delete project '${args.name}'?`,
    { modal: true },
    { title: 'Delete' },
    { title: 'Cancel', isCloseAffordance: true },
  )

  if (confirmDeleteResult?.title !== 'Delete') return

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deleting project...`,
    },
    () => ppgRepository.deleteProject({ workspaceId: args.workspaceId, id: args.id }),
  )

  void window.showInformationMessage(`Project deleted`)
}
