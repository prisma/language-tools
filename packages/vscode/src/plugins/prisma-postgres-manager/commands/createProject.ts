import { ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { PrismaWorkspaceItem } from '../PrismaPostgresTreeDataProvider'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'

export const createProject = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (args instanceof PrismaWorkspaceItem) {
    workspaceId = args.workspaceId
  } else if (typeof args === 'string') {
    workspaceId = args
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  const name = await window.showInputBox({
    prompt: 'Enter the name of the new project',
  })

  if (!name) throw new CommandAbortError('Project name is required')

  const project = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'Creating project...',
    },
    () => ppgRepository.createProject({ workspaceId, name }),
  )
  ppgRepository.triggerRefresh()

  void window.showInformationMessage(`Project ${name} created`)

  return project
}
