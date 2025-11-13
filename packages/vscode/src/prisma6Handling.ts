import { commands, window, workspace } from 'vscode'

let promptAlreadyShown = false

/**
 * Handles diagnostics related to Prisma 6 and Prisma 7 datasource URL issues.
 * Prompts the user to pin or unpin the workspace to/from Prisma 6 based on the diagnostic message.
 *
 * @param message - The diagnostic message to evaluate.
 */
export function handleDiagnostic(message: string) {
  const prismaConfig = workspace.getConfiguration('prisma')

  // Avoid showing the prompt multiple times per session.
  // Also respect the user's preference to hide the prompts.
  if (promptAlreadyShown || prismaConfig.get('hidePrisma6Prompts')) {
    return
  }

  if (isPrisma6MissingDatasourceUrl(message) && prismaConfig.get('pinToPrisma6')) {
    void window
      .showInformationMessage(
        'Your Prisma schema file is missing the datasource URL. This is expected in Prisma 7, ' +
          'but not Prisma 6. If you intend to use Prisma 7, press the button below to unpin from ' +
          'Prisma 6 within the current workspace.',
        'Unpin from Prisma 6 in this workspace',
        'Do not ask me again',
      )
      .then((selection) => {
        if (selection === 'Unpin from Prisma 6 in this workspace') {
          return commands.executeCommand('prisma.unpinWorkspaceFromPrisma6')
        } else if (selection === 'Do not ask me again') {
          return workspace.getConfiguration('prisma').update('hidePrisma6Prompts', true, true)
        }
      })
    promptAlreadyShown = true
  } else if (isPrisma7UnexpectedDatasourceUrl(message)) {
    void window
      .showInformationMessage(
        'Your Prisma schema file contains a datasource URL, which is not supported in Prisma 7. ' +
          'If you intend to use Prisma 6, press the button below to pin the extension to Prisma 6 ' +
          'within the current workspace.',
        'Pin to Prisma 6 in this workspace',
        'Do not ask me again',
      )
      .then((selection) => {
        if (selection === 'Pin to Prisma 6 in this workspace') {
          return commands.executeCommand('prisma.pinWorkspaceToPrisma6')
        } else if (selection === 'Do not ask me again') {
          return workspace.getConfiguration('prisma').update('hidePrisma6Prompts', true, true)
        }
      })
    promptAlreadyShown = true
  }
}

function isPrisma6MissingDatasourceUrl(message: string): boolean {
  return message.startsWith('Argument "url" is missing in data source block "db".')
}

function isPrisma7UnexpectedDatasourceUrl(message: string): boolean {
  return message.startsWith('The datasource property `url` is no longer supported in schema files.')
}
