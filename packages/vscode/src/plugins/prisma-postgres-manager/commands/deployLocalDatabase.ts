import { randomUUID } from 'node:crypto'
import TelemetryReporter from '../../../telemetryReporter'
import { LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { createRemoteDatabaseSafely } from './createRemoteDatabase'
import { type ExtensionContext, ProgressLocation, window } from 'vscode'

export interface DeployLocalDatabaseOptions {
  args: unknown
  context: ExtensionContext
  ppgRepository: PrismaPostgresRepository
}

export async function deployLocalDatabase(options: DeployLocalDatabaseOptions): Promise<void> {
  const { args, context, ppgRepository } = options

  const telemetryReporter = new TelemetryReporter(
    `prisma.${context.extension.id}.dev`,
    (context.extension.packageJSON as { version: string }).version,
  )

  try {
    const { name } = LocalDatabaseSchema.parse(args)

    const attemptEventId = randomUUID()

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

    const database = await ppgRepository.getLocalDatabase({ name })

    if (database?.running) {
      const confirmation = await window.showInformationMessage(
        'To deploy your local Prisma Postgres database, you will need to stop the database first. Proceed?',
        { modal: true },
        'Yes',
      )

      if (confirmation !== 'Yes') {
        void window.showInformationMessage('Deployment cancelled.')
        return
      }
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

    void window.showInformationMessage('Deployment was successful!')
  } finally {
    telemetryReporter.dispose()
  }
}
