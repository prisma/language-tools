import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { commands, ProgressLocation, window } from 'vscode'
import { CommandAbortError } from '../shared-ui/handleCommandError'
import { Disposable } from 'vscode'

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
    (_, cancelToken) => {
      let listener: Disposable | undefined
      let cancellation: Disposable | undefined
      let timeout: NodeJS.Timeout | undefined

      return new Promise<void>((resolve, reject) => {
        listener = ppgRepository.refreshEventEmitter.event(async () => {
          if (await hasWorkspaces()) return resolve()
        })

        cancellation = cancelToken.onCancellationRequested(() => {
          reject(new CommandAbortError('Login cancelled.'))
        })

        timeout = setTimeout(() => {
          reject(new CommandAbortError('Login timed out. Please try again.'))
        }, LOGIN_TIMEOUT_MS)

        if (cancelToken.isCancellationRequested) {
          reject(new CommandAbortError('Login cancelled.'))
          return
        }

        void hasWorkspaces()
          .then((hasAccess) => {
            if (hasAccess) resolve()
          })
          .catch((error) => reject(error))
      }).finally(() => {
        clearTimeout(timeout)
        listener?.dispose()
        cancellation?.dispose()
      })
    },
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
