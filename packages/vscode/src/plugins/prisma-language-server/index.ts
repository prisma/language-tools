import path from 'path'
import fs from 'fs'
import FileWatcher from 'watcher'
import type { type as FileWatcherType } from 'watcher'

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

const packageJson = require('../../../../package.json') // eslint-disable-line

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let watcherInstance: FileWatcherType

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

// periodically clean up the allowedWatcherPaths
setInterval(() => {
  for (const path in allowedWatcherPaths) {
    if (!fs.existsSync(path)) {
      delete allowedWatcherPaths[path]
    }
  }
}, 10000)

/**
 * These are the paths that are watched by the file watcher. We have to specify
 * the full paths that we will watch, otherwise we will get a lot of events.
 * All these paths are necessary for the file watcher to work properly. Read
 * > ignore: https://github.com/fabiospampinato/watcher#options
 */
const allowedWatcherPaths: Record<string, boolean> = {}
const startFileWatcher = (rootPath: string) => {
  console.debug('Starting File Watcher')
  // https://github.com/fabiospampinato/watcher
  return new FileWatcher(rootPath, {
    debounce: 500,
    // limits how many levels of subdirectories will be traversed.
    // Note that `node_modules/.prisma/client/` counts for 3 already
    // Example
    // If vs code extension is open in root folder of a project and the path to index.d.ts is
    // ./server/database/node_modules/.prisma/client/index.d.ts
    // then the depth is equal to 2 + 3 = 5
    depth: 9,
    recursive: true,
    ignoreInitial: true,
    ignore(targetPath) {
      if (!targetPath.startsWith(rootPath)) return true
      if (targetPath.endsWith('.git')) return true

      // for all the sub-directories of the project, allow recursion into node_modules
      if (fs.statSync(targetPath).isDirectory() && !targetPath.includes('node_modules')) {
        allowedWatcherPaths[path.join(targetPath, 'node_modules')] = true
        return false
      }

      // but every time we hit a project path, we ensure some sub-paths are whitelisted
      if (fs.statSync(targetPath).isDirectory()) {
        try {
          // we get the location of installation of the @prisma/client package
          const clientPath = path.dirname(require.resolve('@prisma/client', { paths: [targetPath] }))
          const dotClientPath = path.resolve(clientPath, '..', '..', '.prisma', 'client', 'index.d.ts')

          // if we have seen this path already, we don't need to save it again
          if (allowedWatcherPaths[dotClientPath] !== undefined) return false
          const dotClientArrayPath = dotClientPath.split(path.sep)

          // decompose the path into an all the possible steps of its sub-paths
          // eg. "a/b/c/d"" will become [ "a", "a/b", "a/b/c", "a/b/c/d" ]
          dotClientArrayPath
            .map((_, index) => dotClientArrayPath.slice(0, index + 1).join(path.sep))
            .filter((path) => path.includes(rootPath))
            .forEach((path) => (allowedWatcherPaths[path] = true))

          // display the paths that will be watched for the given @prisma/client
          console.log(`Watched paths ${JSON.stringify(Object.keys(allowedWatcherPaths), null, 2)}`)
        } catch {
          // if we couldn't find the @prisma/client package, nothing got whitelisted
        }
      }

      if (targetPath in allowedWatcherPaths) return false

      return true
    },
  })
}

const onFileChange = (filepath: string) => {
  console.debug(`File ${filepath} has been changed. Restarting TS Server.`)
  commands.executeCommand('typescript.restartTsServer') // eslint-disable-line
}

const plugin: PrismaVSCodePlugin = {
  name: 'prisma-language-server',
  enabled: () => true,
  activate: async (context) => {
    const isDebugOrTest = isDebugOrTestSession()

    const rootPath = workspace.workspaceFolders?.[0].uri.path
    if (rootPath) {
      // This setting defaults to true (see package.json of vscode extension)
      const isFileWatcherEnabled = workspace.getConfiguration('prisma').get('fileWatcher')

      if (isFileWatcherEnabled) {
        watcherInstance = startFileWatcher(rootPath)
        console.debug('File Watcher is enabled and started.')
      } else {
        console.debug('File Watcher is disabled.')
      }
    } else {
      console.debug('File Watcher was skipped, rootPath is falsy')
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (packageJson.name === 'prisma-insider-pr-build') {
      console.log('Using local Language Server for prisma-insider-pr-build')
      serverModule = context.asAbsolutePath(path.join('./language-server/dist/src/bin'))
    } else if (isDebugMode() || isE2ETestOnPullRequest()) {
      // use Language Server from folder for debugging
      console.log('Using local Language Server from filesystem')
      serverModule = context.asAbsolutePath(path.join('../../packages/language-server/dist/src/bin'))
    } else {
      console.log('Using published Language Server (npm)')
      // use published npm package for production
      serverModule = require.resolve('@prisma/language-server/dist/src/bin')
    }
    console.log(`serverModule: ${serverModule}`)

    // The debug options for the server
    // --inspect=6009: runs the server in Node's Inspector mode so VSCode can attach to the server for debugging
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
    // const config = workspace.getConfiguration('prisma')

    workspace.onDidChangeConfiguration(
      (event) => {
        const fileWatcherConfigChanged = event.affectsConfiguration('prisma.fileWatcher')

        if (fileWatcherConfigChanged) {
          const isFileWatcherEnabled = workspace.getConfiguration('prisma').get('fileWatcher')
          const rootPath = workspace.workspaceFolders?.[0].uri.path
          // This setting defaults to true (see package.json of vscode extension)
          if (isFileWatcherEnabled) {
            // if watcherInstance.closed === true, the watcherInstance was closed previously and can be safely restarted
            // if watcherInstance.closed === false, it is already running
            // but if the JSON settings are empty like {} and the user enables the file watcherInstance
            // we need to catch that case to avoid starting another extra file watcherInstance
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access

            if (watcherInstance && watcherInstance.isClosed() === false) {
              console.debug(
                "onDidChangeConfiguration: watcherInstance.isClosed() === false so it's already running. Do nothing.",
              )
            } else {
              // Let's start it
              if (rootPath) {
                watcherInstance = startFileWatcher(rootPath)
                // If the file was just created
                watcherInstance.on('add', onFileChange)
                // If the file was modified
                watcherInstance.on('change', onFileChange)
                console.debug('onDidChangeConfiguration: File Watcher is now enabled and started.')
              } else {
                console.debug('onDidChangeConfiguration: rootPath is falsy')
              }
            }
          } else {
            // Let's stop it
            if (watcherInstance) {
              watcherInstance.close()
              console.debug('onDidChangeConfiguration: File Watcher stopped.')
            } else {
              console.debug('onDidChangeConfiguration: No File Watcher found')
            }
          }
        }
      },
      null,
      context.subscriptions,
    )

    context.subscriptions.push(
      commands.registerCommand('prisma.restartLanguageServer', async () => {
        client = await restartClient(context, client, serverOptions, clientOptions)
        window.showInformationMessage('Prisma language server restarted.') // eslint-disable-line @typescript-eslint/no-floating-promises
      }),

      /* This command is part of the workaround for https://github.com/prisma/language-tools/issues/311 */
      commands.registerCommand('prisma.applySnippetWorkspaceEdit', applySnippetWorkspaceEdit()),

      commands.registerCommand('prisma.filewatcherEnable', async () => {
        const prismaConfig = workspace.getConfiguration('prisma')
        // First, is set to true value
        // Second, is set it on Workspace level settings
        await prismaConfig.update('fileWatcher', true, false)
      }),

      commands.registerCommand('prisma.filewatcherDisable', async () => {
        const prismaConfig = workspace.getConfiguration('prisma')
        // First, is set to false value
        // Second, is set it on Workspace level settings
        await prismaConfig.update('fileWatcher', false, false)
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

    if (watcherInstance) {
      watcherInstance.on('add', onFileChange)
      watcherInstance.on('change', onFileChange)
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
