import { commands } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'

export const login = async (ppgRepository: PrismaPostgresRepository) => {
  if ((await ppgRepository.getWorkspaces()).length === 0) {
    await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', true)
  }
  await ppgRepository.workspaceLogin()
  await commands.executeCommand('setContext', 'prisma.initialLoginInProgress', false)
}
