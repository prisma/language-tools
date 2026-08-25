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
  createLegacyLanguageServer,
} from '../../util'
import { PrismaVSCodePlugin } from '../types'
import paths from 'env-paths'
import FileWatcher from 'watcher'
import { CodelensProvider, generateClient } from '../../CodeLensProvider'
import * as prisma6Handling from '../../prisma6Handling'
import { getPackageJSON } from '../../getPackageJSON'
import { DocumentOwnershipCoordinator } from './documentOwnership'
import { createLegacyClientMiddleware, type LegacyClientMiddleware } from './legacyClientMiddleware'
import { createPrepareDocumentRoutingCommit } from './documentRouting'
import { PrismaNextClientRegistry } from './prismaNextClientRegistry'
import { LanguageServerLifecycleController } from './languageServerLifecycle'

let legacyClient: LanguageClient
let legacyServerModule: string
let telemetry: TelemetryReporter
let fileWatcher: FileWatcher.type | undefined
let languageServerLifecycle: LanguageServerLifecycleController | undefined
let prismaNextClientRegistry: PrismaNextClientRegistry | undefined

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true'
const logLegacyClientError = (error: unknown): void => {
  console.error('Legacy Prisma Language Server failed', error)
}

const activateLegacyClientNow = async (
  context: ExtensionContext,
  legacyClientOptions: LanguageClientOptions,
  lifecycle: LanguageServerLifecycleController,
): Promise<void> => {
  lifecycle.assertActive()
  const prismaConfig = workspace.getConfiguration('prisma')
  lifecycle.assertActive()
  const client = createLegacyLanguageServer(getLegacyServerOptions(prismaConfig, context), legacyClientOptions)
  lifecycle.publishLegacyClient(client)
  legacyClient = client

  lifecycle.assertActive()
  context.subscriptions.push(client.start())
  await lifecycle.waitFor(client.onReady())
  lifecycle.assertActive()
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

    let legacyUnavailable = false
    let restarting = false
    languageServerLifecycle?.dispose().catch(logLegacyClientError)
    const lifecycle = new LanguageServerLifecycleController()
    languageServerLifecycle = lifecycle
    const ownership: DocumentOwnershipCoordinator = new DocumentOwnershipCoordinator({
      workspace,
      policy: {
        isPinnedToPrisma6: () => !!workspace.getConfiguration('prisma').get<boolean>('pinToPrisma6'),
        isLegacyUnavailable: () => legacyUnavailable,
      },
      prepareTransition: createPrepareDocumentRoutingCommit({
        getOwnership: (): DocumentOwnershipCoordinator => ownership,
        isActive: () => lifecycle.isActive,
        isDocumentOpen: (document) => workspace.textDocuments.includes(document),
        getLegacy: () => legacyClientMiddleware,
        getPrismaNext: () => prismaNextClients,
      }),
    })
    const prismaNextClients = new PrismaNextClientRegistry({
      workspace,
      ownership,
      isActive: () => lifecycle.isActive,
      getDocument: (uri) => workspace.textDocuments.find((document) => document.uri.toString() === uri.toString()),
      createClient: (id, name, serverOptions, prismaNextClientOptions) =>
        new LanguageClient(id, name, serverOptions, prismaNextClientOptions),
      registerDisposable: (disposable) => context.subscriptions.push(disposable),
      handleStartError: (workspaceFolder, error) => {
        console.error(`Failed to start Prisma Next Language Server for ${workspaceFolder.uri.toString()}`, error)
      },
    })
    prismaNextClientRegistry = prismaNextClients

    const legacyClientMiddleware: LegacyClientMiddleware = createLegacyClientMiddleware({
      ownership,
      isActive: () => lifecycle.isActive,
      getClient: () => legacyClient,
      getDocument: (uri) => workspace.textDocuments.find((document) => document.uri.toString() === uri.toString()),
      handleDiagnosticMessage: (message) => {
        void prisma6Handling.handleDiagnostic(message, context)
      },
      isSnippetEdit,
    })

    // Options to control the language client
    const legacyClientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: 'file', language: 'prisma' }],
      middleware: legacyClientMiddleware,
    }

    let startRequested = false
    let started = false
    let ready = false
    const needsLegacyLanguageServer = (document: TextDocument): boolean =>
      document.languageId === 'prisma' && ownership.getDesiredOwner(document).kind === 'legacy'
    const getOpenPrismaDocuments = (): TextDocument[] =>
      workspace.textDocuments.filter((document) => document.languageId === 'prisma')

    const waitForOwnershipOperations = async (operations: readonly Promise<unknown>[]): Promise<void> => {
      const results = await Promise.allSettled(operations)
      const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failure) throw failure.reason
    }

    const synchronizeDocuments = (documents: readonly TextDocument[]): Promise<void> => {
      lifecycle.assertActive()
      return waitForOwnershipOperations(documents.map((document) => ownership.synchronize(document)))
    }

    const invalidateLegacyDocuments = (): Promise<void> => {
      lifecycle.assertActive()
      const legacyDocuments = getOpenPrismaDocuments().filter(
        (document) => ownership.getSettledOwner(document.uri).kind === 'legacy',
      )
      return waitForOwnershipOperations(legacyDocuments.map((document) => ownership.close(document)))
    }

    const startLegacyLanguageServerNow = async (): Promise<void> => {
      lifecycle.assertActive()
      if (started) return

      started = true
      await activateLegacyClientNow(context, legacyClientOptions, lifecycle)
      ready = true
      lifecycle.assertActive()
      await synchronizeDocuments(getOpenPrismaDocuments())
    }

    const maybeStart = (document?: TextDocument): void => {
      if (!lifecycle.isActive || startRequested || started) return
      if (document ? !needsLegacyLanguageServer(document) : !workspace.textDocuments.some(needsLegacyLanguageServer))
        return

      startRequested = true
      void lifecycle.enqueue(startLegacyLanguageServerNow).catch(logLegacyClientError)
    }

    const synchronizeDocument = (document: TextDocument): void => {
      if (!lifecycle.isActive || restarting || document.languageId !== 'prisma') return
      if (ownership.getDesiredOwner(document).kind === 'legacy') {
        if (!started) maybeStart(document)
        if (!ready) return
      }
      void ownership.synchronize(document).catch(logLegacyClientError)
    }

    const restartLanguageServerNow = async (): Promise<void> => {
      lifecycle.assertActive()
      if (!started) {
        if (getOpenPrismaDocuments().some(needsLegacyLanguageServer)) {
          await startLegacyLanguageServerNow()
        } else {
          await synchronizeDocuments(getOpenPrismaDocuments())
        }
        return
      }

      restarting = true
      ready = false
      legacyUnavailable = true
      try {
        try {
          await invalidateLegacyDocuments()
        } catch (error) {
          legacyUnavailable = false
          if (lifecycle.isActive) {
            try {
              await synchronizeDocuments(getOpenPrismaDocuments())
            } catch (restoreError) {
              logLegacyClientError(restoreError)
            }
          }
          throw error
        }

        lifecycle.assertActive()
        const serverOptions = getLegacyServerOptions(workspace.getConfiguration('prisma'), context)
        const replacement = await restartClient(context, legacyClient, serverOptions, legacyClientOptions, {
          assertActive: () => lifecycle.assertActive(),
          waitFor: (operation) => lifecycle.waitFor(operation),
          onClientStopped: () => legacyClientMiddleware.resetClientState(),
          onClientCreated: (replacementClient) => {
            lifecycle.publishLegacyClient(replacementClient)
            legacyClient = replacementClient
          },
        })
        lifecycle.assertActive()
        legacyClient = replacement
        ready = true
        legacyUnavailable = false
        await synchronizeDocuments(getOpenPrismaDocuments())
      } finally {
        legacyUnavailable = false
        restarting = false
      }
    }

    const restartLanguageServer = (): Promise<void> => lifecycle.enqueue(restartLanguageServerNow)

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

      commands.registerCommand('prisma.pinWorkspaceToPrisma6', () =>
        lifecycle.enqueue(async () => {
          lifecycle.assertActive()
          await workspace.getConfiguration('prisma').update('pinToPrisma6', true, false)
          lifecycle.assertActive()
          await restartLanguageServerNow()
          lifecycle.assertActive()
          void window.showInformationMessage('Pinned workspace to Prisma 6.')
        }),
      ),

      commands.registerCommand('prisma.unpinWorkspaceFromPrisma6', () =>
        lifecycle.enqueue(async () => {
          lifecycle.assertActive()
          await workspace.getConfiguration('prisma').update('pinToPrisma6', false, false)
          lifecycle.assertActive()
          await restartLanguageServerNow()
          lifecycle.assertActive()
          void window.showInformationMessage('Unpinned workspace from Prisma 6.')
        }),
      ),

      workspace.onDidOpenTextDocument((document) => {
        maybeStart(document)
        synchronizeDocument(document)
      }),
      workspace.onDidChangeTextDocument((event) => {
        maybeStart(event.document)
        synchronizeDocument(event.document)
      }),
      workspace.onDidCloseTextDocument((document) => {
        if (lifecycle.isActive && document.languageId === 'prisma') {
          void ownership.close(document).catch(logLegacyClientError)
        }
      }),
    )

    maybeStart()
    for (const document of workspace.textDocuments) {
      synchronizeDocument(document)
    }

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
    const lifecycle = languageServerLifecycle
    const prismaNextClients = prismaNextClientRegistry
    languageServerLifecycle = undefined
    prismaNextClientRegistry = undefined

    const deactivations = [lifecycle?.dispose(), prismaNextClients?.dispose()].filter(
      (deactivation): deactivation is Promise<void> => deactivation !== undefined,
    )
    const results = await Promise.allSettled(deactivations)
    for (const result of results) {
      if (result.status === 'rejected') logLegacyClientError(result.reason)
    }

    if (legacyClient && !isDebugOrTestSession()) {
      telemetry.dispose() // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  },
}

function getLegacyServerOptions(prismaConfig: WorkspaceConfiguration, context: ExtensionContext): ServerOptions {
  const pinToPrisma6 = prismaConfig.get<boolean>('pinToPrisma6')

  if (pinToPrisma6) {
    console.log('Using legacy Prisma 6 Language Server')
    legacyServerModule = context.asAbsolutePath(path.join('dist/prisma6-language-server/bin.js'))
  } else if (isDebugMode()) {
    // Use the legacy Language Server from the source tree for debugging.
    console.log('Using legacy Language Server from filesystem')
    legacyServerModule = context.asAbsolutePath(path.join('../../packages/language-server/dist/bin'))
  } else {
    console.log('Using legacy Language Server')
    legacyServerModule = context.asAbsolutePath(path.join('dist/language-server/bin.js'))
  }
  console.log(`legacyServerModule: ${legacyServerModule}`)

  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = {
    execArgv: ['--nolazy', '--inspect=6009'],
    env: { DEBUG: true },
  }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  return {
    run: { module: legacyServerModule, transport: TransportKind.ipc },
    debug: {
      module: legacyServerModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }
}

export default plugin
