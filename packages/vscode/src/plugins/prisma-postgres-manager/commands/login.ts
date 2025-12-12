import { commands, ProgressLocation, Uri, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { z } from 'zod'

const DEFAULT_UTM_MEDIUM = 'ppg-cloud-list'

export const LoginOptionsSchema = z
  .object({
    utmMedium: z.string().optional().default(DEFAULT_UTM_MEDIUM),
  })
  .optional()
  .default({ utmMedium: DEFAULT_UTM_MEDIUM })

/**
 * This function triggers the OAuth login flow by creating the necessary URL and opening the users browser.
 */
export const login = async (ppgRepository: PrismaPostgresRepository, args: unknown = {}) => {
  const options = LoginOptionsSchema.parse(args)

  if ((await ppgRepository.getWorkspaces()).length === 0) {
    await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', true)
  }
  await ppgRepository.login(options)
  await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', false)
}

/**
 * This function is called when the extension receives the auth callback from the previously started login flow.
 */
export const handleAuthCallback = async ({
  uri,
  ppgRepository,
}: {
  uri: Uri
  ppgRepository: PrismaPostgresRepository
}) => {
  try {
    const handled = await ppgRepository.handleAuthCallback(uri)

    if (!handled) return // received url was not an auth callback

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Logging in to Prisma workspace...',
      },
      () => {
        // Login is already complete at this point - just trigger a refresh
        ppgRepository.triggerRefresh()
        return Promise.resolve()
      },
    )
    void window.showInformationMessage('Workspace connected!')
  } catch (error) {
    console.error(error)
    void window.showErrorMessage('Login to Workspace failed! Please try again.')
  }
}
