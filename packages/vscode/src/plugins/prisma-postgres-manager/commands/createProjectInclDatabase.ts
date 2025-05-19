import { ProgressLocation, window } from 'vscode'
import { isWorkspace, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'

export const createProjectInclDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (isWorkspace(args)) {
    workspaceId = args.id
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

  const result = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating project with database in '${region}'...`,
    },
    () => ppgRepository.createProject({ workspaceId, name, region }),
  )

  if (result.database?.connectionString) {
    await presentConnectionString({
      name: result.database.name,
      region: result.database.region,
      connectionString: result.database.connectionString,
    })
  } else {
    void window.showInformationMessage(`Project ${name} created`)
  }

  return result
}
