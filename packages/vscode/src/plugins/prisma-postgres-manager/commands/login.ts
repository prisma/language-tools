import { commands, ProgressLocation, Uri, window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { Auth } from '../management-api/auth'

/**
 * This function triggers the OAuth login flow by creating the necessary URL and opening the users browser.
 */
export const login = async (ppgRepository: PrismaPostgresRepository, auth: Auth) => {
  if ((await ppgRepository.getWorkspaces()).length === 0) {
    await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', true)
  }
  await auth.login()
  await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', false)
}

/**
 * This function is called when the extension receives the auth callback from the previously started login flow.
 */
export const handleAuthCallback = async ({
  uri,
  ppgRepository,
  auth,
}: {
  uri: Uri
  ppgRepository: PrismaPostgresRepository
  auth: Auth
}) => {
  try {
    const result = await auth.handleCallback(uri)

    if (!result) return // received url was not an auth callback

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Logging in to Prisma workspace...',
      },
      () => ppgRepository.addWorkspace({ token: result.token, refreshToken: result.refreshToken }),
    )
    void window.showInformationMessage('Login to Prisma successful!')
  } catch (error) {
    console.error(error)
    void window.showErrorMessage('Login to Prisma failed! Please try again.')
  }
}
