import { window, workspace, type Diagnostic, type OutputChannel, type Uri } from 'vscode'

const configLoadFailedCode = 'PRISMA_CONFIG_LOAD_FAILED'
const openConfigAction = 'Open config'
const showDetailsAction = 'Show details'

export type ConfigLoadFailureHandler = (uri: Uri, diagnostics: readonly Diagnostic[]) => void

function getDiagnosticCode(diagnostic: Diagnostic): string | number | undefined {
  return typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code
}

async function showConfigLoadFailure(uri: Uri, outputChannel: OutputChannel | undefined): Promise<void> {
  const message = `Prisma could not load "${workspace.asRelativePath(uri)}". Formatting and other language features are unavailable until the configuration loads.`
  const selected = outputChannel
    ? await window.showErrorMessage(message, openConfigAction, showDetailsAction)
    : await window.showErrorMessage(message, openConfigAction)
  if (selected === openConfigAction) {
    await window.showTextDocument(uri)
  } else if (selected === showDetailsAction) {
    outputChannel?.show()
  }
}

export function createConfigLoadFailureHandler(
  getOutputChannel: () => OutputChannel | undefined,
): ConfigLoadFailureHandler {
  const reported = new Map<string, string>()

  return (uri, diagnostics) => {
    const key = uri.toString()
    const failure = diagnostics.find((diagnostic) => getDiagnosticCode(diagnostic) === configLoadFailedCode)
    if (!failure) {
      reported.delete(key)
      return
    }
    if (reported.get(key) === failure.message) return

    reported.set(key, failure.message)
    const outputChannel = getOutputChannel()
    outputChannel?.appendLine(`Failed to load ${uri.fsPath}: ${failure.message}`)
    showConfigLoadFailure(uri, outputChannel).catch((error) =>
      console.error('Failed to report Prisma config load failure', error),
    )
  }
}
