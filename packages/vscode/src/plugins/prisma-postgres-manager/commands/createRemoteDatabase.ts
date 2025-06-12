import { ThemeIcon, window, ProgressLocation, QuickPickItemKind } from 'vscode'
import { PrismaPostgresRepository, ProjectSchema } from '../PrismaPostgresRepository'
import { createProjectInclDatabaseSafely } from './createProjectInclDatabase'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'
import { pickRegion } from '../shared-ui/pickRegion'
import z from 'zod'

export const CreateRemoteDatabaseArgsSchema = z.union([ProjectSchema, z.undefined()])

export type CreateRemoteDatabaseArgs = z.infer<typeof CreateRemoteDatabaseArgsSchema>

const pickProject = async (
  ppgRepository: PrismaPostgresRepository,
  options: { skipRefresh?: boolean },
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
    const result = await createProjectInclDatabaseSafely(ppgRepository, workspaces[0], options)
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

export const createRemoteDatabase = async (
  ppgRepository: PrismaPostgresRepository,
  args: unknown,
  options: { skipRefresh?: boolean },
) => {
  const validatedArgs = CreateRemoteDatabaseArgsSchema.parse(args)
  let workspaceId = validatedArgs?.workspaceId
  let projectId = validatedArgs?.id
  let databaseId: string | undefined

  if (workspaceId === undefined || projectId === undefined) {
    ;({ workspaceId, projectId, databaseId } = await pickProject(ppgRepository, options))
  }

  const workspaces = await ppgRepository.getWorkspaces()
  const workspace = workspaces.find((w) => (w.id = workspaceId))!

  if (databaseId) return // pickProject already created a new project incl database
  if (!projectId) return createProjectInclDatabaseSafely(ppgRepository, workspace, options)

  const regions = ppgRepository.getRegions()

  const name = await window.showInputBox({
    prompt: 'Enter the name of the remote database',
  })
  if (!name) throw new CommandAbortError('Name is required')

  const region = await pickRegion(await regions)

  const database = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Creating remote database...`,
    },
    () =>
      ppgRepository.createRemoteDatabase({
        workspaceId,
        projectId,
        name,
        region: region.id,
        options,
      }),
  )

  await presentConnectionString({
    connectionString: database.connectionString,
    type: 'databaseCreated',
  })

  return { project: { workspaceId, id: projectId }, database }
}

export const createRemoteDatabaseSafely = async (
  ppgRepository: PrismaPostgresRepository,
  args: CreateRemoteDatabaseArgs,
  options: { skipRefresh?: boolean },
) => {
  return createRemoteDatabase(ppgRepository, args, options)
}
