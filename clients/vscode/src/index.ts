import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import { ExtensionContext } from 'vscode'

let client: LanguageClient

const serverModule = require.resolve('@prisma/language-server')

export function activate(context: ExtensionContext) {

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect=6009'],
    env: { DEBUG: true },
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for prisma documents
    documentSelector: [{ scheme: 'file', language: 'prisma' }],
  }

  // Create the language client and start the client.
  client = new LanguageClient(
    'prisma',
    'Prisma Language Server',
    serverOptions,
    clientOptions,
  )

  // Start the client. This will also launch the server
  client.start()
}

export function deactivate(): Thenable<void> | void {
  if (!client) {
    return undefined
  }

  return client.stop()
}
