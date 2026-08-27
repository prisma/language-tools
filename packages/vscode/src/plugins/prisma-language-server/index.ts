import path from 'path'
import os from 'os'
import minimatch from 'minimatch'

import { commands, ExtensionContext, TextDocument, window, workspace, languages, WorkspaceConfiguration } from 'vscode'
import { LanguageClientOptions } from 'vscode-languageclient'
import { LanguageClient, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import TelemetryReporter from '../../telemetryReporter'
import {
  checkForMinimalColorTheme,
  checkForOtherPrismaExtension,
  isDebugOrTestSession,
  isPrismaNextSchema,
  restartClient,
  createLegacyLanguageServer,
} from '../../util'
import { PrismaVSCodePlugin } from '../types'
import paths from 'env-paths'
import FileWatcher from 'watcher'
import { CodelensProvider, generateClient } from '../../CodeLensProvider'
import * as prisma6Handling from '../../prisma6Handling'
import { getPackageJSON } from '../../getPackageJSON'
import { PrismaNextClients } from './prismaNextClients'

let client: LanguageClient
let serverModule: string
let telemetry: TelemetryReporter
let fileWatcher: FileWatcher.type | undefined
let prismaNextClients: PrismaNextClients | undefined

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'

const activateClient = (context: ExtensionContext, clientOptions: LanguageClientOptions) => {
  const prismaConfig = workspace.getConfiguration('prisma')
  // Create the language client
  const serverOptions = getServerOptions(prismaConfig, context)
  client = createLegacyLanguageServer(serverOptions, clientOptions)

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

    // Both language servers receive every open Prisma document and each decides from the
    // `// use prisma-next` directive in the document content whether to respond: the legacy
    // server ignores documents with the directive, the Prisma Next server ignores documents
    // without it. The extension only decides which servers to start.
    const nextClients = new PrismaNextClients((disposable) => context.subscriptions.push(disposable))
    prismaNextClients = nextClients

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
      // Register the server for prisma documents
      documentSelector: [{ scheme: 'file', language: 'prisma' }],
      middleware: {
        handleDiagnostics: (uri, diagnostics, next) => {
          // Serialized: the prompt guards are only persisted after the user responds, so
          // concurrent calls would all pass them and stack duplicate prompts.
          void (async () => {
            for (const diagnostic of diagnostics) {
              await prisma6Handling.handleDiagnostic(diagnostic.message, context)
            }
          })().catch((error) => console.error('Failed to handle Prisma 6 diagnostics', error))
          next(uri, diagnostics)
        },
      },
    }

    const isPinnedToPrisma6 = () => !!workspace.getConfiguration('prisma').get<boolean>('pinToPrisma6')

    let started = false
    const needsLegacyLanguageServer = (doc: TextDocument): boolean =>
      doc.languageId === 'prisma' && (isPinnedToPrisma6() || !isPrismaNextSchema(doc.getText()))
    const needsPrismaNextLanguageServer = (doc: TextDocument): boolean =>
      doc.languageId === 'prisma' && !isPinnedToPrisma6() && isPrismaNextSchema(doc.getText())

    const maybeStart = () => {
      if (started) return
      if (!workspace.textDocuments.some(needsLegacyLanguageServer)) return
      started = true
      activateClient(context, clientOptions)
    }

    const maybeStartPrismaNext = (document: TextDocument) => {
      if (needsPrismaNextLanguageServer(document)) {
        nextClients.ensureClientFor(document)
      }
    }

    const synchronizeServers = (document?: TextDocument) => {
      maybeStart()
      for (const doc of document ? [document] : workspace.textDocuments) {
        maybeStartPrismaNext(doc)
      }
    }

    const restartLanguageServer = async () => {
      await nextClients.stopAll()
      if (started) {
        const serverOptions = getServerOptions(workspace.getConfiguration('prisma'), context)
        client = await restartClient(context, client, serverOptions, clientOptions)
      }
      synchronizeServers()
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

      workspace.onDidOpenTextDocument((document) => synchronizeServers(document)),
      workspace.onDidChangeTextDocument((event) => synchronizeServers(event.document)),
    )

    synchronizeServers()

    if (!isDebugOrTest) {
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
    const nextClients = prismaNextClients
    prismaNextClients = undefined

    const results = await Promise.allSettled([nextClients?.dispose(), client?.stop()])
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Prisma language server deactivation failed', result.reason)
      }
    }

    if (client && !isDebugOrTestSession()) {
      telemetry.dispose() // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  },
}

function getServerOptions(prismaConfig: WorkspaceConfiguration, context: ExtensionContext): ServerOptions {
  const pinToPrisma6 = prismaConfig.get<boolean>('pinToPrisma6')

  if (pinToPrisma6) {
    console.log('Using legacy Prisma 6 Language Server')
    serverModule = context.asAbsolutePath(path.join('dist/prisma6-language-server/bin.js'))
  } else if (isDebugMode()) {
    // Use the legacy Language Server from the source tree for debugging.
    console.log('Using legacy Language Server from filesystem')
    serverModule = context.asAbsolutePath(path.join('../../packages/language-server/dist/bin'))
  } else {
    console.log('Using legacy Language Server')
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
