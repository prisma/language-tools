import { ThemeIcon, window, ProgressLocation, QuickPickItemKind } from 'vscode'
import { isProject, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { createProjectInclDatabase } from './createProjectInclDatabase'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'

const pickProject = async (
  ppgRepository: PrismaPostgresRepository,
): Promise<{ workspaceId: string; projectId?: string; databaseId?: string }> => {
  const workspaces = await ppgRepository.getWorkspaces()

  if (workspaces.length === 0) {
    throw new CommandAbortError('You need to login to Prisma before you can create a remote database.') // TODO: trigger login flow
  }

  const workspacesWithProjects = await Promise.all(
    workspaces.map(async (workspace) => ({
      ...workspace,
      projects: await ppgRepository.getProjects({ workspaceId: workspace.id }),
    })),
  )

  if (workspacesWithProjects.every((workspace) => workspace.projects.length === 0)) {
    const result = await createProjectInclDatabase(ppgRepository, workspaces[0].id)
    return {
      workspaceId: workspaces[0].id,
      projectId: result.project.id,
      databaseId: result.database?.id,
    }
  }

  const projectsQuickPickItems = workspacesWithProjects.flatMap((workspace) => {
    return [
      { type: 'workspace' as const, label: workspace.name, kind: QuickPickItemKind.Separator },
      ...workspace.projects.map((p) => ({
        type: 'project' as const,
        id: p.id,
        workspaceId: workspace.id,
        label: p.name,
        iconPath: new ThemeIcon('project'),
      })),
      {
        type: 'create-project' as const,
        label: 'Create Project',
        iconPath: new ThemeIcon('plus'),
        workspaceId: workspace.id,
      },
    ]
  })

  const selectedItem = await window.showQuickPick(projectsQuickPickItems, {
    placeHolder: 'Choose a project',
  })

  if (selectedItem?.type === 'create-project') {
    return { workspaceId: selectedItem.workspaceId }
  } else if (selectedItem?.type === 'project') {
    return { workspaceId: selectedItem.workspaceId, projectId: selectedItem.id }
  } else {
    throw new CommandAbortError('No project selected')
  }
}

export const createRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  let projectId: string | undefined
  let databaseId: string | undefined
  if (isProject(args)) {
    workspaceId = args.workspaceId
    projectId = args.id
  } else {
    ;({ workspaceId, projectId, databaseId } = await pickProject(ppgRepository))
  }

  if (databaseId) return // pickProject already created a new project incl database
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

  await presentConnectionString(result)
}
