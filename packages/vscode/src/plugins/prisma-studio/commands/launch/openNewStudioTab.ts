import { ExtensionContext, ViewColumn, window } from 'vscode'
import { getStudioPageHtml } from './getStudioPageHtml'
import { startStudioServer } from './startStudioServer'
import TelemetryReporter from '../../../../telemetryReporter'
import type { LaunchArg } from '../../../prisma-postgres-manager/commands/launchStudio'

export interface OpenNewStudioTabArgs {
  context: ExtensionContext
  database?: LaunchArg
  dbUrl: string
}

/**
 * Opens Prisma Studio in a webview panel.
 * @param args - An object containing the database URL and extension context.
 */
export async function openNewStudioTab(args: OpenNewStudioTabArgs) {
  const { context } = args
  const { extension } = context

  const telemetryReporter = new TelemetryReporter(
    `prisma.${extension.id}.studio`,
    (extension.packageJSON as { version: string }).version,
  )

  const { server, url } = await startStudioServer({ ...args, telemetryReporter })

  const panel = window.createWebviewPanel('studio', 'Studio', ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  })

  panel.webview.html = getStudioPageHtml({ serverUrl: url })

  panel.onDidDispose(() => {
    server.close()
    console.log(`Studio server has been closed (${url})`)
    telemetryReporter.dispose()
  })
}
