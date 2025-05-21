import { ExtensionContext, ViewColumn, window } from 'vscode'
import { getWebviewHtml } from './getStudioPageHtml'
import { startStudioServer } from './startStudioServer'

/**
 * Opens Prisma Studio in a webview panel.
 * @param args - An object containing the database URL and extension context.
 */
export async function openNewStudioTab(args: { dbUrl: string; context: ExtensionContext }) {
  const { server, url } = await startStudioServer(args)

  const panel = window.createWebviewPanel('studio', 'Studio', ViewColumn.One, { enableScripts: true })

  panel.webview.html = getWebviewHtml(url)

  panel.onDidDispose(() => {
    server.close()
    console.log(`Studio server has been closed (${url})`)
  })
}
