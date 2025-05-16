import { commands } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { Auth } from '../management-api/auth'

export const login = async (ppgRepository: PrismaPostgresRepository, auth: Auth) => {
  if ((await ppgRepository.getWorkspaces()).length === 0) {
    await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', true)
  }
  await auth.login()
  await ppgRepository.workspaceLogin() // TODO: remove this once actual api connected
  await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', false)
}
