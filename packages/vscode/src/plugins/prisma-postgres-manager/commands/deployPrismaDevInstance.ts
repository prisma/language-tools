import { randomUUID } from 'node:crypto'
import TelemetryReporter from '../../../telemetryReporter'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { createRemoteDatabaseSafely } from './createRemoteDatabase'
import { type ExtensionContext, ProgressLocation, window } from 'vscode'
import { getPackageJSON } from '../../../getPackageJSON'
import { isDebugOrTestSession } from '../../../util'
import { DevInstanceSchema, PrismaDevRepository } from '../PrismaDevRepository'

export interface DeployLocalDatabaseOptions {
  args: unknown
  context: ExtensionContext
  ppgRepository: PrismaPostgresRepository
  prismaDevRepository: PrismaDevRepository
}

export async function deployPrismaDevInstance(options: DeployLocalDatabaseOptions): Promise<void> {
  const { args, context, ppgRepository, prismaDevRepository } = options

  const packageJson = getPackageJSON(context)

  const telemetryReporter = new TelemetryReporter(
    `prisma.${packageJson.name || 'prisma-unknown'}.dev`,
    packageJson.version || '0.0.0',
  )

  try {
    const { name } = DevInstanceSchema.parse(args)

    const attemptEventId = randomUUID()

    const isDebugOrTest = isDebugOrTestSession()

    if (!isDebugOrTest) {
      void telemetryReporter
        .sendTelemetryEvent({
          check_if_update_available: false,
          command: 'deploy-to-ppg-attempt',
          client_event_id: attemptEventId,
          information: JSON.stringify({
            name,
          }),
        })
        .catch(() => {
          // noop
        })
    }

    const devInstance = await prismaDevRepository.getInstance({ name })

    if (devInstance?.running) {
      const confirmation = await window.showInformationMessage(
        'To deploy your Prisma Dev database, you will need to stop the database first. Proceed?',
        { modal: true },
        'Yes',
      )

      if (confirmation !== 'Yes') {
        return void window.showInformationMessage('Deployment cancelled.')
      }
    }

    const createdDb = await createRemoteDatabaseSafely(ppgRepository, undefined, { skipRefresh: true })

    if (createdDb?.database == null) {
      throw new Error('Unexpected error, no database was returned')
    }

    const {
      database,
      project: { workspaceId, id: projectId },
    } = createdDb

    if (!database.connectionString) {
      database.connectionString = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: `Creating connection string...`,
        },
        () =>
          ppgRepository.createRemoteDatabaseConnectionString({
            databaseId: database.id,
            projectId,
            workspaceId,
          }),
      )
    }

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Deploying remote database...`,
      },
      async () => {
        await prismaDevRepository.deployInstance({ name, url: database.connectionString! })
        ppgRepository.triggerRefresh()
      },
    )

    if (!isDebugOrTest) {
      void telemetryReporter
        .sendTelemetryEvent({
          check_if_update_available: false,
          client_event_id: randomUUID(),
          command: 'deploy-to-ppg-success',
          information: JSON.stringify({
            name,
            projectId,
            workspaceId,
          }),
          previous_client_event_id: attemptEventId,
        })
        .catch(() => {
          // noop
        })
    }

    await window.showInformationMessage('Deployment was successful!')
  } finally {
    telemetryReporter.dispose()
  }
}
