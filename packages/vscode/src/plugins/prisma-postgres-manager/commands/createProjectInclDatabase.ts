import { ProgressLocation, window } from 'vscode'
import { isWorkspace, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'
import { pickRegion } from '../shared-ui/pickRegion'

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

  const region = await pickRegion(await regions)

  const result = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating project with database...`,
    },
    () => ppgRepository.createProject({ workspaceId, name, region: region.id }),
  )

  if (result.database?.connectionString) {
    await presentConnectionString({
      connectionString: result.database.connectionString,
      type: 'databaseCreated',
    })
  } else {
    void window.showInformationMessage(`Project created`)
  }

  return result
}
