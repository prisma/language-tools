import { ThemeIcon, window, env, ProgressLocation } from 'vscode'
import { PrismaProjectItem, PrismaWorkspaceItem } from '../PrismaPostgresTreeDataProvider'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { createProject } from './createProject'

const pickProject = async (ppgRepository: PrismaPostgresRepository, workspaceId: string) => {
  const projects = await ppgRepository.getProjects({ workspaceId })

  if (projects.length === 0) {
    return (await createProject(ppgRepository, workspaceId)).id
  }

  // TODO: Or put projects of all workspaces in the quick pick together?
  const projectsQuickPickItems = [
    ...projects.map((p) => ({ type: 'project' as const, id: p.id, label: p.name, iconPath: new ThemeIcon('project') })),
    { type: 'create-project' as const, label: 'Create Project', iconPath: new ThemeIcon('plus') },
  ]
  const selectedItem = await window.showQuickPick(projectsQuickPickItems, {
    placeHolder: 'Choose a project',
  })

  if (!selectedItem) {
    throw new Error('No project selected')
  } else if (selectedItem.type === 'create-project') {
    return (await createProject(ppgRepository, workspaceId)).id
  } else if (selectedItem.type === 'project') {
    return selectedItem.id
  } else {
    throw new Error('Missing project ID')
  }
}

export const createRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (args instanceof PrismaWorkspaceItem || args instanceof PrismaProjectItem) {
    workspaceId = args.workspaceId
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  console.log('workspaceId', workspaceId)

  let projectId: string
  if (args instanceof PrismaProjectItem) {
    projectId = args.projectId
  } else {
    projectId = await pickProject(ppgRepository, workspaceId)
  }
  console.log('projectId', projectId)

  const regions = ppgRepository.getRegions()

  const name = await window.showInputBox({
    prompt: 'Enter the name of the remote database',
  })
  const region = await window.showQuickPick(await regions, {
    placeHolder: 'Select the region of the remote database',
  })

  if (!name) throw new Error('Name is required')
  if (!region) throw new Error('Region is required')

  const result = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'Creating remote database...',
    },
    () => ppgRepository.createRemoteDatabase({ workspaceId, projectId, name, region }),
  )

  ppgRepository.triggerRefresh()

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
