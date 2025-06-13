import { ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository, WorkspaceSchema } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'
import { pickRegion } from '../shared-ui/pickRegion'
import z from 'zod'

export const CreateProjectInclDatabaseArgsSchema = z.union([WorkspaceSchema, z.undefined()])

export type CreateProjectInclDatabaseArgs = z.infer<typeof CreateProjectInclDatabaseArgsSchema>

export const createProjectInclDatabase = async (
  ppgRepository: PrismaPostgresRepository,
  args: unknown,
  options: { skipRefresh?: boolean },
) => {
  const validatedArgs = CreateProjectInclDatabaseArgsSchema.parse(args)
  let workspaceId = validatedArgs?.id

  if (workspaceId === undefined) {
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
    () => ppgRepository.createProject({ workspaceId, name, region: region.id, options }),
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

export const createProjectInclDatabaseSafely = async (
  ppgRepository: PrismaPostgresRepository,
  args: CreateProjectInclDatabaseArgs,
  options: { skipRefresh?: boolean },
) => {
  return createProjectInclDatabase(ppgRepository, args, options)
}
