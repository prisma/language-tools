import { ProgressLocation, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { presentConnectionString } from '../shared-ui/connectionStringMessage'
import { pickRegion } from '../shared-ui/pickRegion'
import z from 'zod'

export const CreateProjectInclDatabaseArgsSchema = z.union([
  z.object({
    id: z.string().optional(), // workspaceId
    skipRefresh: z.boolean().optional(),
  }),
  z.undefined(),
])

export type CreateProjectInclDatabaseArgs = z.infer<typeof CreateProjectInclDatabaseArgsSchema>

export const createProjectInclDatabase = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  const validatedArgs = CreateProjectInclDatabaseArgsSchema.parse(args) ?? {}
  let { id: workspaceId } = validatedArgs
  const { skipRefresh } = validatedArgs

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
    () => ppgRepository.createProject({ workspaceId, name, region: region.id, skipRefresh }),
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
) => {
  return createProjectInclDatabase(ppgRepository, args)
}
