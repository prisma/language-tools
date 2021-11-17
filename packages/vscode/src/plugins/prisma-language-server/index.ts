import * as chokidar from 'chokidar'
import path from 'path'
import {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  Command,
  commands,
  ExtensionContext,
  Range,
  TextDocument,
  window,
  workspace,
} from 'vscode'
import {
  CodeAction as lsCodeAction,
  CodeActionParams,
  CodeActionRequest,
  LanguageClientOptions,
  ProvideCodeActionsSignature,
} from 'vscode-languageclient'
import {
  LanguageClient,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import TelemetryReporter from '../../telemetryReporter'
import {
  applySnippetWorkspaceEdit,
  checkForMinimalColorTheme,
  checkForOtherPrismaExtension,
  isDebugOrTestSession,
  isSnippetEdit,
  restartClient,
  createLanguageServer,
} from '../../util'
import { PrismaVSCodePlugin } from '../types'

const packageJson = require('../../../../package.json') // eslint-disable-line

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let watcher: chokidar.FSWatcher

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'
const isE2ETestOnPullRequest = () => process.env.localLSP === 'true'

const activateClient = (
  context: ExtensionContext,
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions,
) => {
  // Create the language client
  client = createLanguageServer(serverOptions, clientOptions)

  const disposable = client.start()

  // Start the client. This will also launch the server
  context.subscriptions.push(disposable)
}

const plugin: PrismaVSCodePlugin = {
  name: 'prisma-language-server',
  enabled: () => true,
  activate: async (context) => {
    const isDebugOrTest = isDebugOrTestSession()
    const rootPath = workspace.workspaceFolders?.[0].uri.path

    if (rootPath) {
      watcher = chokidar.watch(
        path.join(rootPath, '**/node_modules/.prisma/client/index.d.ts'),
        {
          // ignore dotfiles (except .prisma) adjusted from chokidar README example
          ignored: /(^|[\/\\])\.(?!prisma)./,
          // limits how many levels of subdirectories will be traversed.
          // Note that `node_modules/.prisma/client/` counts for 3 already
          // Example
          // If vs code extension is open in root folder of a project and the path to index.d.ts is
          // ./server/database/node_modules/.prisma/client/index.d.ts
          // then the depth is equal to 2 + 3 = 5
          depth: 9,
          // When false, only the symlinks themselves will be watched for changes
          // instead of following the link references and bubbling events through the link's path.
          followSymlinks: false,
        },
      )
    }

    if (isDebugMode() || isE2ETestOnPullRequest()) {
      // use LSP from folder for debugging
      console.log('Using local LSP')
      serverModule = context.asAbsolutePath(
        path.join('../../packages/language-server/dist/src/bin'),
      )
    } else {
      console.log('Using published LSP')
      // use published npm package for production
      serverModule = require.resolve('@prisma/language-server/dist/src/bin')
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
            textDocument:
              client.code2ProtocolConverter.asTextDocumentIdentifier(document),
            range: client.code2ProtocolConverter.asRange(range),
            context: client.code2ProtocolConverter.asCodeActionContext(context),
          }

          return client.sendRequest(CodeActionRequest.type, params, token).then(
            (values) => {
              if (values === null) return undefined
              const result: (CodeAction | Command)[] = []
              for (const item of values) {
                if (lsCodeAction.is(item)) {
                  const action =
                    client.protocol2CodeConverter.asCodeAction(item)
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
    // const config = workspace.getConfiguration('prisma')

    workspace.onDidChangeConfiguration(
      async (e) => { },
      null,
      context.subscriptions,
    )

    context.subscriptions.push(
      commands.registerCommand('prisma.restartLanguageServer', async () => {
        client = await restartClient(
          context,
          client,
          serverOptions,
          clientOptions,
        )
        window.showInformationMessage('Prisma language server restarted.') // eslint-disable-line @typescript-eslint/no-floating-promises
      }),
      commands.registerCommand(
        'prisma.applySnippetWorkspaceEdit',
        applySnippetWorkspaceEdit(),
      ),
    )

      activateClient(context, serverOptions, clientOptions)

    if (!isDebugOrTest) {
      // eslint-disable-next-line
      const extensionId = 'prisma.' + packageJson.name
      // eslint-disable-next-line
      const extensionVersion = packageJson.version

      telemetry = new TelemetryReporter(extensionId, extensionVersion)

      context.subscriptions.push(telemetry)

      await telemetry.sendTelemetryEvent()

      if (extensionId === 'prisma.prisma-insider') {
        checkForOtherPrismaExtension()
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
