import { ThemeIcon } from 'vscode'

import { window } from 'vscode'
import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { CommandAbortError } from './handleCommandError'

export const pickWorkspace = async (ppgRepository: PrismaPostgresRepository) => {
  const workspaces = await ppgRepository.getWorkspaces()

  const workspacesQuickPickItems = [
    ...workspaces.map((w) => ({ workspace: w, label: w.name, iconPath: new ThemeIcon('folder') })),
  ]
  const selectedItem = await window.showQuickPick(workspacesQuickPickItems, {
    placeHolder: 'Select the workspace',
  })

  if (!selectedItem) throw new CommandAbortError('Workspace is required')

  return selectedItem.workspace
}
