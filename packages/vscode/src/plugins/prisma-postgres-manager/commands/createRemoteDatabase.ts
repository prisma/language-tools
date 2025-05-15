import { ThemeIcon, window, env, ProgressLocation, QuickPickItemKind } from 'vscode'
import { PrismaProjectItem } from '../PrismaPostgresTreeDataProvider'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { createProjectInclDatabase } from './createProjectInclDatabase'
import { CommandAbortError } from '../shared-ui/handleCommandError'

const pickProject = async (
  ppgRepository: PrismaPostgresRepository,
): Promise<{ workspaceId: string; projectId: string | null }> => {
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
    return {
      workspaceId: workspaces[0].id,
      projectId: (await createProjectInclDatabase(ppgRepository, workspaces[0].id)).id,
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
    return { workspaceId: selectedItem.workspaceId, projectId: null }
  } else if (selectedItem?.type === 'project') {
    return { workspaceId: selectedItem.workspaceId, projectId: selectedItem.id }
  } else {
    throw new CommandAbortError('No project selected')
  }
}

export const createRemoteDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  let projectId: string | null
  if (args instanceof PrismaProjectItem) {
    workspaceId = args.workspaceId
    projectId = args.projectId
  } else {
    ;({ workspaceId, projectId } = await pickProject(ppgRepository))
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
