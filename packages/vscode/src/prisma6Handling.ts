import { commands, ExtensionContext, window, workspace } from 'vscode'

const hidePrisma6PromptsConfigKey = 'hidePrisma6Prompts'
const prisma6PromptStateKey = 'wasPrisma6PromptShown'

/**
 * Handles diagnostics related to Prisma 6 and Prisma 7 datasource URL issues.
 * Prompts the user to pin or unpin the workspace to/from Prisma 6 based on the diagnostic message.
 *
 * @param message - The diagnostic message to evaluate.
 */
export async function handleDiagnostic(message: string, context: ExtensionContext) {
  const prismaConfig = workspace.getConfiguration('prisma')

  // Avoid showing the prompt multiple times per workspace.
  // Also respect the user's preference to hide the prompts.
  if (
    context.workspaceState.get<boolean>(prisma6PromptStateKey, false) ||
    prismaConfig.get(hidePrisma6PromptsConfigKey)
  ) {
    return
  }

  if (isPrisma6MissingDatasourceUrl(message) && prismaConfig.get('pinToPrisma6')) {
    const selection = await window.showInformationMessage(
      'Your Prisma schema file is missing the datasource URL and the current workspace is ' +
        'pinned to Prisma 6. The datasource URL is required in Prisma 6, but no longer expected ' +
        'in Prisma 7. If you intend to use Prisma 7, press the button below to unpin the ' +
        'current workspace from Prisma 6. If you want to continue using Prisma 6, you can ignore ' +
        'this message.',
      'Unpin this workspace from Prisma 6',
      'Do not ask me again',
    )
    if (selection === 'Unpin this workspace from Prisma 6') {
      await commands.executeCommand('prisma.unpinWorkspaceFromPrisma6')
    } else if (selection === 'Do not ask me again') {
      await prismaConfig.update(hidePrisma6PromptsConfigKey, true, true)
    }
    await context.workspaceState.update(prisma6PromptStateKey, true)
  } else if (isPrisma7UnexpectedDatasourceUrl(message)) {
    const selection = await window.showInformationMessage(
      'Your Prisma schema file contains a datasource URL, which is not supported in Prisma 7. ' +
        'If you intend to use Prisma 6, press the button below to pin the current workspace to ' +
        'Prisma 6. If you want to continue using Prisma 7, you can ignore this message.',
      'Pin this workspace to Prisma 6',
      'Do not ask me again',
    )
    if (selection === 'Pin this workspace to Prisma 6') {
      await commands.executeCommand('prisma.pinWorkspaceToPrisma6')
    } else if (selection === 'Do not ask me again') {
      await prismaConfig.update(hidePrisma6PromptsConfigKey, true, true)
    }
    await context.workspaceState.update(prisma6PromptStateKey, true)
  }
}

function isPrisma6MissingDatasourceUrl(message: string): boolean {
  return message.startsWith('Argument "url" is missing in data source block "db".')
}

function isPrisma7UnexpectedDatasourceUrl(message: string): boolean {
  return message.startsWith('The datasource property `url` is no longer supported in schema files.')
}
