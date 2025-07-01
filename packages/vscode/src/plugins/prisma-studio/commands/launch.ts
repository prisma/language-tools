import { type ExtensionContext, window } from 'vscode'
import { openNewStudioTab } from './launch/openNewStudioTab'
import type { LaunchArg } from '../../prisma-postgres-manager/commands/launchStudio'

export interface LaunchArgs {
  context: ExtensionContext
  database?: LaunchArg
  dbUrl?: string
}

/**
 * Launches Prisma Studio, prompting for a database URL if not provided.
 * @param args - An object containing the database URL and extension context.
 */
export async function launch(args: LaunchArgs) {
  if (args.dbUrl != null) {
    // @ts-expect-error it's fine. typescript go home.
    return openNewStudioTab(args)
  }

  const dbUrl = await window.showInputBox({
    prompt: 'Enter your Prisma Postgres database URL',
    placeHolder: 'e.g., prisma+postgres://accelerate.prisma-data.net/?api_key=xxx',
  })

  // TODO: improve URL validation
  if (dbUrl === undefined || dbUrl === '') {
    return window.showErrorMessage('A valid URL is required to launch Prisma Studio.')
  }

  return openNewStudioTab({ ...args, dbUrl })
}
