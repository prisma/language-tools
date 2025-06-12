import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'
import { createRemoteDatabaseSafely } from './createRemoteDatabase'
import { ProgressLocation, window } from 'vscode'

export const DeployLocalDatabaseArgsSchema = z.object({
  name: z.string(),
  pid: z.number(),
  url: z.string(),
  running: z.boolean(),
})

export type DeployLocalDatabaseArgs = z.infer<typeof DeployLocalDatabaseArgsSchema>

export async function deployLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { name, pid, url, running } = DeployLocalDatabaseArgsSchema.parse(args)

  if (running) {
    const confirmation = await window.showInformationMessage(
      'To deploy your local Prisma Postgres database, you will need to stop the database first. Proceed?',
      { modal: true },
      'Yes',
    )

    if (confirmation !== 'Yes') {
      void window.showInformationMessage('Deployment cancelled.')
      return
    }

    await ppgRepository.stopLocalDatabase({ pid, url })
  }

  const createdDb = await createRemoteDatabaseSafely(ppgRepository, undefined, { skipRefresh: true })

  if (createdDb?.database === undefined) {
    throw new Error('Unexpected error, no database was returned')
  }

  const {
    database: { connectionString },
    project: { workspaceId, id: projectId },
  } = createdDb

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deploying remote database...`,
    },
    () => ppgRepository.deployLocalDatabase({ name, url: connectionString, projectId, workspaceId }),
  )

  void window.showInformationMessage('Deployment was successful!')
}

export async function deployLocalDatabaseSalefy(
  ppgRepository: PrismaPostgresRepository,
  args: DeployLocalDatabaseArgs,
) {
  return deployLocalDatabase(ppgRepository, args)
}
