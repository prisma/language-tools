import { ExtensionContext, Uri, ViewColumn, window } from 'vscode'
import { getStudioPageHtml } from './getStudioPageHtml'
import { startStudioServer } from './startStudioServer'
import TelemetryReporter from '../../../../telemetryReporter'
import type { LaunchArg } from '../../../prisma-postgres-manager/commands/launchStudio'
import { getPackageJSON } from '../../../../getPackageJSON'

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

  const packageJSON = getPackageJSON(context)

  const telemetryReporter = new TelemetryReporter(
    `prisma.${packageJSON.name || 'prisma-unknown'}.studio`,
    (packageJSON as { version: string }).version || '0.0.0',
  )

  const { server, url } = await startStudioServer({ ...args, telemetryReporter })

  const panelTitle = args.database?.name ?? 'Studio'

  const panel = window.createWebviewPanel('studio', panelTitle, ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  })

  panel.iconPath = Uri.joinPath(context.extensionUri, 'prisma_icon.svg')

  panel.webview.html = getStudioPageHtml({ serverUrl: url })

  panel.onDidDispose(() => {
    server.close()
    console.log(`Studio server has been closed (${url})`)
    telemetryReporter.dispose()
  })
}
