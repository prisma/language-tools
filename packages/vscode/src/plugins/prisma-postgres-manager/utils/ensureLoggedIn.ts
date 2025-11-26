import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { commands, ProgressLocation, window } from 'vscode'
import { CommandAbortError } from '../shared-ui/handleCommandError'

const LOGIN_TIMEOUT_MS = 2 * 60 * 1000

async function waitForWorkspaceAccess(ppgRepository: PrismaPostgresRepository): Promise<void> {
  const hasWorkspaces = async () => (await ppgRepository.getWorkspaces({ reload: true })).length > 0

  if (await hasWorkspaces()) return

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: 'Waiting for Prisma login to finish...',
      cancellable: true,
    },
    (_, cancelToken) =>
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout)
          listener.dispose()
          cancellation.dispose()
        }

        const listener = ppgRepository.refreshEventEmitter.event(async () => {
          if (await hasWorkspaces()) {
            cleanup()
            resolve()
          }
        })

        const cancellation = cancelToken.onCancellationRequested(() => {
          cleanup()
          reject(new CommandAbortError('Login cancelled.'))
        })

        const timeout = setTimeout(() => {
          cleanup()
          reject(new CommandAbortError('Login timed out. Please try again.'))
        }, LOGIN_TIMEOUT_MS)

        if (cancelToken.isCancellationRequested) {
          cleanup()
          reject(new CommandAbortError('Login cancelled.'))
          return
        }

        void hasWorkspaces()
          .then((hasAccess) => {
            if (hasAccess) {
              cleanup()
              resolve()
            }
          })
          .catch((error) => {
            cleanup()
            reject(error)
          })
      }),
  )
}

export async function ensureLoggedIn(ppgRepository: PrismaPostgresRepository): Promise<void> {
  const hasWorkspaces = (await ppgRepository.getWorkspaces()).length > 0

  if (hasWorkspaces) {
    return
  }

  const confirmation = await window.showInformationMessage(
    'You need to login to Prisma to deploy your local Postgres DB.',
    { modal: true },
    'Sign in now',
  )

  if (confirmation !== 'Sign in now') {
    return
  }

  await commands.executeCommand('prisma.login')

  await waitForWorkspaceAccess(ppgRepository)

  const postLoginWorkspaces = await ppgRepository.getWorkspaces()

  if (postLoginWorkspaces.length === 0) {
    throw new CommandAbortError('Login required before deploying Prisma Dev instance.')
  }
}
