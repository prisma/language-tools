import path from 'path'
import os from 'os'
import minimatch from 'minimatch'

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
  languages,
} from 'vscode'
import {
  CodeAction as lsCodeAction,
  CodeActionParams,
  CodeActionRequest,
  LanguageClientOptions,
  ProvideCodeActionsSignature,
} from 'vscode-languageclient'
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node'
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
import paths from 'env-paths'
import FileWatcher from 'watcher'
import { CodelensProvider, generateClient } from '../../CodeLensProvider'
import { showPDPNotification } from '../../notifications'

const packageJson = require('../../../../package.json') // eslint-disable-line

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let fileWatcher: FileWatcher.type | undefined

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'
const isE2ETestOnPullRequest = () => process.env.PRISMA_USE_LOCAL_LS === 'true'

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

const onFileChange = (filepath: string) => {
  console.debug(`File ${filepath} has changed, restarting TS Server.`)
  void commands.executeCommand('typescript.restartTsServer')
}

function startGenerateWatcher() {
  if (fileWatcher !== undefined) return

  // macOS watcher to be removed in future releases
  const rootPath = workspace.workspaceFolders?.[0].uri.path
  if (os.platform() === 'darwin' && rootPath !== undefined) {
    fileWatcher = new FileWatcher(rootPath, {
      depth: 9,
      debounce: 500,
      recursive: true,
      ignoreInitial: true,
      ignore: (targetPath) => {
        if (targetPath === rootPath) return false
        return !minimatch(targetPath, '**/node_modules/.prisma/client/index.d.ts')
      },
    })
    console.log(`Watching ${rootPath} for changes (old watcher).`)
  } else {
    const prismaCache = paths('prisma').cache
    const signalsPath = path.join(prismaCache, 'last-generate')
    const fwOptions = { debounce: 500, ignoreInitial: true }
    fileWatcher = new FileWatcher(signalsPath, fwOptions)
    console.log(`Watching ${signalsPath} for changes (new watcher).`)
  }

  fileWatcher.on('change', onFileChange)
  fileWatcher.on('add', onFileChange)
}

function stopGenerateWatcher() {
  if (fileWatcher === undefined) return

  fileWatcher.close()
  fileWatcher = undefined

  console.log('Stopped watching for changes.')
}

function setGenerateWatcher(enabled: boolean) {
  if (enabled) {
    startGenerateWatcher()
  } else {
    stopGenerateWatcher()
  }
}

const plugin: PrismaVSCodePlugin = {
  name: 'prisma-language-server',
  enabled: () => true,
  activate: async (context) => {
    const isDebugOrTest = isDebugOrTestSession()
    const codelensProvider = new CodelensProvider()

    languages.registerCodeLensProvider('*', codelensProvider)

    setGenerateWatcher(!!workspace.getConfiguration('prisma').get('fileWatcher'))

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (packageJson.name === 'prisma-insider-pr-build') {
      console.log('Using local Language Server for prisma-insider-pr-build')
      serverModule = context.asAbsolutePath(path.join('./language-server/dist/bin'))
    } else if (isDebugMode() || isE2ETestOnPullRequest()) {
      // use Language Server from folder for debugging
      console.log('Using local Language Server from filesystem')
      serverModule = context.asAbsolutePath(path.join('../../packages/language-server/dist/bin'))
    } else {
      console.log('Using published Language Server (npm)')
      // use published npm package for production
      serverModule = require.resolve('@prisma/language-server/dist/bin')
    }
    console.log(`serverModule: ${serverModule}`)

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

      /* This middleware is part of the workaround for https://github.com/prisma/language-tools/issues/311 */
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
            textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
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
                    isSnippetEdit(item, client.code2ProtocolConverter.asTextDocumentIdentifier(document)) &&
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
      } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    await showPDPNotification()

    context.subscriptions.push(
      // when the file watcher settings change, we need to ensure they are applied
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('prisma.fileWatcher')) {
          setGenerateWatcher(!!workspace.getConfiguration('prisma').get('fileWatcher'))
        }
      }),

      commands.registerCommand('prisma.generate', (args: string) => generateClient(args)),

      commands.registerCommand('prisma.restartLanguageServer', async () => {
        client = await restartClient(context, client, serverOptions, clientOptions)
        window.showInformationMessage('Prisma language server restarted.') // eslint-disable-line @typescript-eslint/no-floating-promises
      }),

      commands.registerCommand('prisma.enableCodeLens', async () => {
        await workspace.getConfiguration('prisma').update('enableCodeLens', true, true)
      }),

      commands.registerCommand('prisma.disableCodeLens', async () => {
        await workspace.getConfiguration('prisma').update('enableCodeLens', false, true)
      }),

      /* This command is part of the workaround for https://github.com/prisma/language-tools/issues/311 */
      commands.registerCommand('prisma.applySnippetWorkspaceEdit', applySnippetWorkspaceEdit()),

      commands.registerCommand('prisma.filewatcherEnable', async () => {
        const prismaConfig = workspace.getConfiguration('prisma')
        await prismaConfig.update('fileWatcher', true /* value */, false /* workspace */)
      }),

      commands.registerCommand('prisma.filewatcherDisable', async () => {
        const prismaConfig = workspace.getConfiguration('prisma')
        await prismaConfig.update('fileWatcher', false /* value */, false /* workspace */)
      }),
    )

    activateClient(context, serverOptions, clientOptions)

    if (!isDebugOrTest) {
      // eslint-disable-next-line
      const extensionId = 'prisma.' + packageJson.name
      // eslint-disable-next-line
      const extensionVersion: string = packageJson.version

      telemetry = new TelemetryReporter(extensionId, extensionVersion)

      context.subscriptions.push(telemetry)

      await telemetry.sendTelemetryEvent()

      if (extensionId === 'prisma.prisma-insider') {
        checkForOtherPrismaExtension()
      }
    }

    checkForMinimalColorTheme()
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
