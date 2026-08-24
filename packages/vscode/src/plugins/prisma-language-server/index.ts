import path from 'path'
import os from 'os'
import minimatch from 'minimatch'

import { commands, ExtensionContext, TextDocument, window, workspace, languages, WorkspaceConfiguration } from 'vscode'
import { LanguageClientOptions } from 'vscode-languageclient'
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
import * as prisma6Handling from '../../prisma6Handling'
import { getPackageJSON } from '../../getPackageJSON'
import { DocumentOwnershipCoordinator } from './documentOwnership'
import { createBundledClientMiddleware } from './bundledClientMiddleware'
import { LocalPrismaNextClientRegistry, localPrismaNextClientTestStateCommand } from './localPrismaNextClientRegistry'

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let fileWatcher: FileWatcher.type | undefined

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'

const activateClient = (context: ExtensionContext, clientOptions: LanguageClientOptions) => {
  const prismaConfig = workspace.getConfiguration('prisma')
  // Create the language client
  const serverOptions = getServerOptions(prismaConfig, context)
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

    const localClients = new LocalPrismaNextClientRegistry({
      workspace,
      createClient: (id, name, serverOptions, localClientOptions) =>
        new LanguageClient(id, name, serverOptions, localClientOptions),
      registerDisposable: (disposable) => context.subscriptions.push(disposable),
      handleStartError: (workspaceFolder, error) => {
        console.error(`Failed to start Prisma Next Language Server for ${workspaceFolder.uri.toString()}`, error)
      },
    })
    const ownership = new DocumentOwnershipCoordinator({
      workspace,
      policy: {
        isPinnedToPrisma6: () => !!workspace.getConfiguration('prisma').get<boolean>('pinToPrisma6'),
      },
      prepareOwner: async ({ document, nextOwner }) => {
        if (nextOwner.kind === 'local') {
          await localClients.ensureClientForDocument(document)
        }
      },
    })

    const bundledClientMiddleware = createBundledClientMiddleware({
      ownership,
      getClient: () => client,
      getDocument: (uri) => workspace.textDocuments.find((document) => document.uri.toString() === uri.toString()),
      handleDiagnosticMessage: (message) => {
        void prisma6Handling.handleDiagnostic(message, context)
      },
      isSnippetEdit,
    })

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for prisma documents
      documentSelector: [{ scheme: 'file', language: 'prisma' }],
      middleware: bundledClientMiddleware,
    }

    let started = false
    const needsLanguageServer = (doc: TextDocument): boolean =>
      doc.languageId === 'prisma' && ownership.classify(doc).kind === 'bundled'
    const prepareLocalClient = (document: TextDocument): void => {
      if (document.languageId === 'prisma' && ownership.classify(document).kind === 'local') {
        void ownership.synchronize(document)
      }
    }

    const maybeStart = () => {
      if (started) return
      if (!workspace.textDocuments.some(needsLanguageServer)) return
      started = true
      activateClient(context, clientOptions)
    }

    const restartLanguageServer = async () => {
      if (!started) {
        maybeStart()
        return
      }
      const serverOptions = getServerOptions(workspace.getConfiguration('prisma'), context)
      client = await restartClient(context, client, serverOptions, clientOptions, {
        onClientStopped: () => bundledClientMiddleware.resetClientState(),
        onClientCreated: (replacementClient) => {
          client = replacementClient
        },
      })
    }

    context.subscriptions.push(
      // when the file watcher settings change, we need to ensure they are applied
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('prisma.fileWatcher')) {
          setGenerateWatcher(!!workspace.getConfiguration('prisma').get('fileWatcher'))
        }
      }),

      commands.registerCommand('prisma.generate', (args: string) => generateClient(args)),

      commands.registerCommand('prisma.restartLanguageServer', async () => {
        await restartLanguageServer()
        if (started) {
          void window.showInformationMessage('Prisma language server restarted.')
        }
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

      commands.registerCommand('prisma.pinWorkspaceToPrisma6', async () => {
        await workspace.getConfiguration('prisma').update('pinToPrisma6', true, false)
        await restartLanguageServer()
        void window.showInformationMessage('Pinned workspace to Prisma 6.')
      }),

      commands.registerCommand('prisma.unpinWorkspaceFromPrisma6', async () => {
        await workspace.getConfiguration('prisma').update('pinToPrisma6', false, false)
        await restartLanguageServer()
        void window.showInformationMessage('Unpinned workspace from Prisma 6.')
      }),

      workspace.onDidOpenTextDocument((document) => {
        maybeStart()
        prepareLocalClient(document)
      }),
      workspace.onDidChangeTextDocument((event) => {
        maybeStart()
        prepareLocalClient(event.document)
      }),
    )

    maybeStart()
    for (const document of workspace.textDocuments) {
      prepareLocalClient(document)
    }

    if (isDebugOrTest) {
      context.subscriptions.push(
        commands.registerCommand(localPrismaNextClientTestStateCommand, () => localClients.getTestState()),
      )
    } else {
      const packageJSON = getPackageJSON(context)
      const extensionId = 'prisma.' + packageJSON.name
      const extensionVersion = packageJSON.version ?? 'unknown'

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

function getServerOptions(prismaConfig: WorkspaceConfiguration, context: ExtensionContext): ServerOptions {
  const pinToPrisma6 = prismaConfig.get<boolean>('pinToPrisma6')

  if (pinToPrisma6) {
    console.log('Using bundled Prisma 6 Language Server')
    serverModule = context.asAbsolutePath(path.join('dist/prisma6-language-server/bin.js'))
  } else if (isDebugMode()) {
    // use Language Server from folder for debugging
    console.log('Using local Language Server from filesystem')
    serverModule = context.asAbsolutePath(path.join('../../packages/language-server/dist/bin'))
  } else {
    // use bundled language server
    console.log('Using bundled Language Server')
    serverModule = context.asAbsolutePath(path.join('dist/language-server/bin.js'))
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
  return {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }
}

export default plugin
