import { window, workspace, type Diagnostic, type Uri } from 'vscode'

const configLoadFailedCode = 'PRISMA_CONFIG_LOAD_FAILED'
const openConfigAction = 'Open config'

export type ConfigLoadFailureHandler = (uri: Uri, diagnostics: readonly Diagnostic[]) => void

function getDiagnosticCode(diagnostic: Diagnostic): string | number | undefined {
  return typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code
}

async function showConfigLoadFailure(uri: Uri): Promise<void> {
  const selected = await window.showErrorMessage(
    `Prisma could not load "${workspace.asRelativePath(uri)}". Formatting and other language features are unavailable until the configuration loads.`,
    openConfigAction,
  )
  if (selected === openConfigAction) {
    await window.showTextDocument(uri)
  }
}

export function createConfigLoadFailureHandler(): ConfigLoadFailureHandler {
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
    showConfigLoadFailure(uri).catch((error) => console.error('Failed to report Prisma config load failure', error))
  }
}
