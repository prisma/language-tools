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
  isDebugOrTestSession,
  checkForMinimalColorTheme,
} from './util'
import { check } from 'checkpoint-client'
import { getProjectHash } from './hashes'
import * as chokidar from 'chokidar'
const packageJson = require('../../package.json') // eslint-disable-line

let client: LanguageClient
let telemetry: Telemetry
let serverModule: string
let watcher: chokidar.FSWatcher

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'
const isE2ETestOnPullRequest = () => process.env.localLSP === 'true'

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

  const rootPath = workspace.rootPath
  if (rootPath) {
    watcher = chokidar.watch(
      path.join(rootPath, '**/node_modules/.prisma/client/index.d.ts'),
      {
        usePolling: false,
      },
    )
  }
  if (isDebugMode() || isE2ETestOnPullRequest()) {
    // use LSP from folder for debugging
    console.log('Using local LSP')
    serverModule = context.asAbsolutePath(
      path.join('../../packages/language-server/dist/src/cli'),
    )
  } else {
    console.log('Using published LSP.')
    // use published npm package for production
    serverModule = require.resolve('@prisma/language-server/dist/src/cli')
  }

  // eslint-disable-next-line
  const extensionId = 'prisma.' + packageJson.name
  // eslint-disable-next-line
  const extensionVersion = packageJson.version
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  client.onReady().then(() => {
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
      window.showInformationMessage('Prisma language server restarted.') // eslint-disable-line @typescript-eslint/no-floating-promises
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
    await check({
      product: extensionId, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      version: extensionVersion, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      project_hash: await getProjectHash(),
    })
  }

  checkForMinimalColorTheme()
  if (watcher) {
    watcher.on('change', (path) => {
      console.log(`File ${path} has been changed. Restarting TS Server.`)
      commands.executeCommand('typescript.restartTsServer') // eslint-disable-line
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
    telemetry.reporter.dispose() // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  return client.stop()
}
