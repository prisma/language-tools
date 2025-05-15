import { ThemeIcon, window, env, ProgressLocation } from 'vscode'
import { PrismaProjectItem, PrismaWorkspaceItem } from '../PrismaPostgresTreeDataProvider'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { createProjectInclDatabase } from './createProjectInclDatabase'
import { CommandAbortError } from '../shared-ui/handleCommandError'

const pickProject = async (ppgRepository: PrismaPostgresRepository, workspaceId: string) => {
  const projects = await ppgRepository.getProjects({ workspaceId })

  if (projects.length === 0) {
    return (await createProjectInclDatabase(ppgRepository, workspaceId)).id
  }

  // TODO: Or put projects of all workspaces in the quick pick together?
  const projectsQuickPickItems = [
    ...projects.map((p) => ({ type: 'project' as const, id: p.id, label: p.name, iconPath: new ThemeIcon('project') })),
    { type: 'create-project' as const, label: 'Create Project', iconPath: new ThemeIcon('plus') },
  ]
  const selectedItem = await window.showQuickPick(projectsQuickPickItems, {
    placeHolder: 'Choose a project',
  })

  if (selectedItem?.type === 'create-project') {
    return null
  } else if (selectedItem?.type === 'project') {
    return selectedItem.id
  } else {
    throw new CommandAbortError('No project selected')
  }
}

export const createRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (args instanceof PrismaWorkspaceItem || args instanceof PrismaProjectItem) {
    workspaceId = args.workspaceId
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  let projectId: string | null
  if (args instanceof PrismaProjectItem) {
    projectId = args.projectId
  } else {
    projectId = await pickProject(ppgRepository, workspaceId)
  }

  if (!projectId) return createProjectInclDatabase(ppgRepository, workspaceId)

  const regions = ppgRepository.getRegions()

  const name = await window.showInputBox({
    prompt: 'Enter the name of the remote database',
  })
  if (!name) throw new CommandAbortError('Name is required')

  const region = await window.showQuickPick(await regions, {
    placeHolder: 'Select the region of the remote database',
  })
  if (!region) throw new CommandAbortError('Region is required')

  const result = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating remote database in '${region}'...`,
    },
    () => ppgRepository.createRemoteDatabase({ workspaceId, projectId, name, region }),
  )

  await window.showInformationMessage(
    `Remote database ${result.name} created in ${result.region}.`,
    {
      detail: `Connection string: ${result.connectionString}\n\nThis connection string will only be shown once!`,
      modal: true,
    },
    { title: 'Copy connection string', isCloseAffordance: true },
  )

  await env.clipboard.writeText(result.connectionString)
}
