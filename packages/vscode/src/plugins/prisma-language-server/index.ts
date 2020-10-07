import * as chokidar from 'chokidar'
import path from 'path'
import {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  Command,
  commands,
  Range,
  TextDocument,
  window,
  workspace,
} from 'vscode'
import {
  CodeAction as lsCodeAction,
  CodeActionParams,
  CodeActionRequest,
  LanguageClient,
  LanguageClientOptions,
  ProvideCodeActionsSignature,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import TelemetryReporter from '../../telemetryReporter'
import {
  applySnippetWorkspaceEdit,
  checkForMinimalColorTheme,
  checkForOtherPrismaExtension,
  isDebugOrTestSession,
  isSnippetEdit,
} from '../../util'
import { PrismaVSCodePlugin } from '../types'

const packageJson = require('../../../../package.json') // eslint-disable-line

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let watcher: chokidar.FSWatcher

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'
const isE2ETestOnPullRequest = () => process.env.localLSP === 'true'

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

const plugin: PrismaVSCodePlugin = {
  name: 'prisma-language-server',
  enabled: () => true,
  activate: async (context) => {
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
                  const action = client.protocol2CodeConverter.asCodeAction(
                    item,
                  )
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

    // Start the client. This will also launch the server
    context.subscriptions.push(disposable)

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
      // eslint-disable-next-line
      const extensionId = 'prisma.' + packageJson.name
      // eslint-disable-next-line
      const extensionVersion = packageJson.version
      telemetry = new TelemetryReporter(extensionId, extensionVersion)
      context.subscriptions.push(telemetry)
      await telemetry.sendTelemetryEvent()
      if (extensionId === 'prisma.prisma-insider') {
        checkForOtherPrismaExtension(extensionId)
      }
    }

    checkForMinimalColorTheme()
    if (watcher) {
      watcher.on('change', (path) => {
        console.log(`File ${path} has been changed. Restarting TS Server.`)
        commands.executeCommand('typescript.restartTsServer') // eslint-disable-line
      })
    }
  },
  deactivate: async () => {
    if (!client) {
      return undefined
    }
    if (!isDebugOrTestSession()) {
      telemetry.dispose() // eslint-disable-line @typescript-eslint/no-floating-promises
    }
    return client.stop()
  },
}
export default plugin
