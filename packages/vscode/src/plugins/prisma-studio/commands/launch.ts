import { ExtensionContext, window } from 'vscode'
import { openNewStudioTab } from './launch/openNewStudioTab'

/**
 * Launches Prisma Studio, prompting for a database URL if not provided.
 * @param args - An object containing the database URL and extension context.
 */
export async function launch(args: { dbUrl?: string; context: ExtensionContext }) {
  const { dbUrl } = args

  if (dbUrl === undefined) {
    const dbUrl = await window.showInputBox({
      prompt: 'Enter your Prisma Postgres database URL',
      placeHolder: 'e.g., prisma+postgres://accelerate.prisma-data.net/?api_key=xxx',
    })

    // TODO: improve URL validation
    if (dbUrl === undefined || dbUrl === "") {
      return window.showErrorMessage('A valid URL is required to launch Prisma Studio.')
    }

    return openNewStudioTab({ ...args, dbUrl })
  }

  return openNewStudioTab({ ...args, dbUrl })
}
