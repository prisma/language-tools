import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  CodeActionParams,
  ProvideCodeActionsSignature,
  CodeActionRequest,
  CodeAction as lsCodeAction,
} from 'vscode-languageclient'
import {
  ExtensionContext,
  commands,
  window,
  TextDocument,
  Range,
  CodeActionContext,
  CancellationToken,
  CodeAction,
  Command,
  workspace,
} from 'vscode'
import { Telemetry, TelemetryPayload, ExceptionPayload } from './telemetry'
import path from 'path'
import {
  applySnippetWorkspaceEdit,
  isSnippetEdit,
  tryRequire,
  isDebugOrTestSession,
} from './util'

let client: LanguageClient
let telemetry: Telemetry
let serverModule: string

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'

class GenericLanguageServerException extends Error {
  constructor(message: string, stack: string) {
    super()
    this.name = 'GenericLanguageServerException'
    this.stack = stack
    this.message = message
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
  const isDebugOrTest = isDebugOrTestSession()
  if (isDebugMode()) {
    // use LSP from folder for debugging
    serverModule = context.asAbsolutePath(
      path.join('../../packages/language-server/dist/src/cli'),
    )
  } else {
    // use published npm package for production
    serverModule = require.resolve('@prisma/language-server/dist/src/cli')
  }

  const pj = tryRequire(path.join(__dirname, '../../package.json'))
  if (!pj) {
    return
  }
  const extensionId = 'prisma.' + pj.name
  const extensionVersion = pj.version
  if (!isDebugOrTest) {
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
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/.prisma/client/*.d.ts'),
    },
    middleware: {
      async provideCodeActions(
        document: TextDocument,
        range: Range,
        context: CodeActionContext,
        token: CancellationToken,
        _: ProvideCodeActionsSignature,
      ) {
        const params: CodeActionParams = {
          textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(
            document,
          ),
          range: client.code2ProtocolConverter.asRange(range),
          context: client.code2ProtocolConverter.asCodeActionContext(context),
        }
        return client.sendRequest(CodeActionRequest.type, params, token).then(
          (values) => {
            if (values === null) return undefined
            const result: (CodeAction | Command)[] = []
            for (const item of values) {
              if (lsCodeAction.is(item)) {
                const action = client.protocol2CodeConverter.asCodeAction(item)
                if (
                  isSnippetEdit(
                    item,
                    client.code2ProtocolConverter.asTextDocumentIdentifier(
                      document,
                    ),
                  ) &&
                  item.edit !== undefined
                ) {
                  action.command = {
                    command: 'prisma.applySnippetWorkspaceEdit',
                    title: '',
                    arguments: [action.edit],
                  }
                  action.edit = undefined
                }
                result.push(action)
              } else {
                const command = client.protocol2CodeConverter.asCommand(item)
                result.push(command)
              }
            }
            return result
          },
          (_) => undefined,
        )
      },
    } as any,
  }

  // Create the language client
  client = createLanguageServer(serverOptions, clientOptions)

  const disposable = client.start()

  client.onReady().then(() => {
    client.onNotification('prisma/didChangeWatchedFiles', () => {
      console.log('Restarting TS Language Server..')
      commands.executeCommand('typescript.restartTsServer')
    })
    if (!isDebugOrTest) {
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
  },
    () => { })

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
    commands.registerCommand(
      'prisma.applySnippetWorkspaceEdit',
      applySnippetWorkspaceEdit(),
    ),
  )
  if (!isDebugOrTest) {
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
