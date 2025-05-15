import { ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { PrismaWorkspaceItem } from '../PrismaPostgresTreeDataProvider'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'

export const createProjectInclDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (args instanceof PrismaWorkspaceItem) {
    workspaceId = args.workspaceId
  } else if (typeof args === 'string') {
    workspaceId = args
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  const regions = ppgRepository.getRegions()

  const name = await window.showInputBox({
    prompt: 'Enter the name of the new project',
  })
  if (!name) throw new CommandAbortError('Project name is required')

  const region = await window.showQuickPick(await regions, {
    placeHolder: 'Select the region for the database in this new project',
  })
  if (!region) throw new CommandAbortError('Region is required')

  const project = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating project with database in '${region}'...`,
    },
    () => ppgRepository.createProject({ workspaceId, name, region }),
  )

  void window.showInformationMessage(`Project ${name} created`)

  return project
}
