import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import { ExtensionContext, commands, window } from 'vscode'
import { Telemetry, TelemetryPayload, ExceptionPayload } from './telemetry'
import path from 'path'

let client: LanguageClient
let telemetry: Telemetry

class GenericLanguageServerException extends Error {
  constructor(message: string, stack: string) {
    super()
    this.name = 'GenericLanguageServerException'
    this.stack = stack
    this.message = message
  }
}

function tryRequire(path: string): any {
  try {
    return require(path)
  } catch (err) {
    console.error(err)
    return
  }
}

function createLanguageServer(
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions,
) {
  return new LanguageClient(
    'prisma',
    'Prisma Language Server',
    serverOptions,
    clientOptions,
  )
}

export function activate(context: ExtensionContext) {
  const serverModule = require.resolve('@prisma/language-server/dist/src/cli')

  const pj = tryRequire(path.join(__dirname, '../../package.json'))
  if (!pj) {
    return
  }
  const extensionId = 'prisma.' + pj.name
  const extensionVersion = pj.version
  telemetry = new Telemetry(extensionId, extensionVersion)

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

  // Create the language client
  client = createLanguageServer(serverOptions, clientOptions)

  const disposable = client.start()

  client.onReady().then(() => {
    client.onNotification('prisma/telemetry', (payload: TelemetryPayload) => {
      // eslint-disable-next-line no-console
      telemetry.sendEvent(payload.action, payload.attributes)
    })
    client.onNotification(
      'prisma/telemetryException',
      (payload: ExceptionPayload) => {
        const error = new GenericLanguageServerException(
          payload.message,
          payload.stack,
        )
        telemetry.sendException(error, {
          signature: payload.signature,
        })
      },
    )
  })

  // Start the client. This will also launch the server
  context.subscriptions.push(disposable)
  context.subscriptions.push(telemetry.reporter)

  context.subscriptions.push(
    commands.registerCommand('prisma.restartLanguageServer', async () => {
      await client.stop()
      client = createLanguageServer(serverOptions, clientOptions)
      context.subscriptions.push(client.start())
      await client.onReady()
      window.showInformationMessage('Prisma language server restarted.')
    }),
  )

  telemetry.sendEvent('activated', {})
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  telemetry.sendEvent('deactivated', {})
  telemetry.reporter.dispose()
  return client.stop()
}
