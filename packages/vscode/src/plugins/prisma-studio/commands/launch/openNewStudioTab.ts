import { ExtensionContext, Uri, ViewColumn, WebviewPanel, window } from 'vscode'
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

const openPanels = new Map<string, WebviewPanel>()

function getPanelKey(args: OpenNewStudioTabArgs): string {
  if (!args.database) {
    return `manual:${args.dbUrl}`
  }

  const { database } = args

  if (database.type === 'local') {
    return `local:${database.name}`
  }

  const nameKey = `${database.workspaceId}/${database.projectId}/${database.databaseId}`

  return `remote:${nameKey}`
}

/**
 * Opens Prisma Studio in a webview panel.
 * @param args - An object containing the database URL and extension context.
 */
export async function openNewStudioTab(args: OpenNewStudioTabArgs) {
  const panelKey = getPanelKey(args)

  const existingPanel = openPanels.get(panelKey)
  if (existingPanel) {
    existingPanel.reveal(existingPanel.viewColumn ?? ViewColumn.One, false)
    return
  }

  const { context } = args

  const packageJSON = getPackageJSON(context)

  const telemetryReporter = new TelemetryReporter(
    `prisma.${packageJSON.name || 'prisma-unknown'}.studio`,
    packageJSON.version || '0.0.0',
  )

  const { server, url } = await startStudioServer({ ...args, telemetryReporter })

  const panelTitle = args.database?.name ?? 'Studio'

  const panel = window.createWebviewPanel('studio', panelTitle, ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
  })

  openPanels.set(panelKey, panel)

  panel.iconPath = Uri.joinPath(context.extensionUri, 'prisma_icon.svg')

  panel.webview.html = getStudioPageHtml({ serverUrl: url })

  panel.onDidDispose(() => {
    const registeredPanel = openPanels.get(panelKey)
    if (registeredPanel === panel) {
      openPanels.delete(panelKey)
    }
    server.close()
    console.log(`Studio server has been closed (${url})`)
    telemetryReporter.dispose()
  })
}
