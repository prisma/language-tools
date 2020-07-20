import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import { ExtensionContext, commands, window, env } from 'vscode'
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

function isDebugOrTestSession(): boolean {
  return env.sessionId === 'someValue.sessionId'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
): LanguageClient {
  return new LanguageClient(
    'prisma',
    'Prisma Language Server',
    serverOptions,
    clientOptions,
  )
}

export async function activate(context: ExtensionContext): Promise<void> {
  const serverModule = require.resolve('@prisma/language-server/dist/src/cli')

  const pj = tryRequire(path.join(__dirname, '../../package.json'))
  if (!pj) {
    return
  }
  const extensionId = 'prisma.' + pj.name
  const extensionVersion = pj.version
  if (!isDebugOrTestSession()) {
    telemetry = new Telemetry(extensionId, extensionVersion)
  }

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
    if (!isDebugOrTestSession()) {
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
    }
  })

  // Start the client. This will also launch the server
  context.subscriptions.push(disposable)
  if (!isDebugOrTestSession()) {
    context.subscriptions.push(telemetry.reporter)
  }

  context.subscriptions.push(
    commands.registerCommand('prisma.restartLanguageServer', async () => {
      await client.stop()
      client = createLanguageServer(serverOptions, clientOptions)
      context.subscriptions.push(client.start())
      await client.onReady()
      window.showInformationMessage('Prisma language server restarted.')
    }),
  )
  if (!isDebugOrTestSession()) {
    telemetry.sendEvent('activated', {
      signature: await telemetry.getSignature(),
    })
  }
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return undefined
  }
  if (!isDebugOrTestSession()) {
    telemetry.sendEvent('deactivated', {
      signature: await telemetry.getSignature(),
    })
    telemetry.reporter.dispose()
  }

  return client.stop()
}
