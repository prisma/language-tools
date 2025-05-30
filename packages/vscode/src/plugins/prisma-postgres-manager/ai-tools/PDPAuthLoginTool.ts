import type {
  LanguageModelTool,
  ProviderResult,
  PreparedToolInvocation,
  CancellationToken,
  LanguageModelToolInvocationPrepareOptions,
} from 'vscode'
import { commands, LanguageModelToolResult, LanguageModelTextPart } from 'vscode'

export class PDPAuthLoginTool implements LanguageModelTool<void> {
  invoke() {
    void commands.executeCommand('prisma.login')
    return new LanguageModelToolResult([
      new LanguageModelTextPart(
        'Login kicked off. Please let the user follow the instructions of VSCode and their Browser to complete the login.',
      ),
    ])
  }

  prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<void>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: 'Starting Prisma Workspace login...',
    }
  }
}
