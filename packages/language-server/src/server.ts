import {
  IConnection,
  TextDocuments,
  Diagnostic,
  createConnection,
  IPCMessageReader,
  IPCMessageWriter,
  InitializeParams,
  InitializeResult,
  CodeActionKind,
  CodeActionParams,
  HoverParams,
  CompletionItem,
  CompletionParams,
  DeclarationParams,
  RenameParams,
  DocumentFormattingParams,
  CodeAction,
  DidChangeConfigurationNotification,
} from 'vscode-languageserver'
import { getSignature } from 'checkpoint-client'
import { sendTelemetry, sendException, initializeTelemetry } from './telemetry'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as MessageHandler from './MessageHandler'
import * as util from './util'
import install from './install'
import { LSPOptions, LSPSettings } from './settings'
const packageJson = require('../../package.json') // eslint-disable-line

function getConnection(options?: LSPOptions): IConnection {
  let connection = options?.connection
  if (!connection) {
    connection = process.argv.includes('--stdio')
      ? createConnection(process.stdin, process.stdout)
      : createConnection(
          new IPCMessageReader(process),
          new IPCMessageWriter(process),
        )
  }
  return connection
}

let hasCodeActionLiteralsCapability = false
let hasConfigurationCapability = false
let defaultBinPath = ''

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSPOptions): void {
  const connection: IConnection = getConnection(options)
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

  connection.onInitialize(async (params: InitializeParams) => {
    initializeTelemetry(connection)
    const capabilities = params.capabilities

    hasCodeActionLiteralsCapability = Boolean(
      capabilities?.textDocument?.codeAction?.codeActionLiteralSupport,
    )
    hasConfigurationCapability = Boolean(capabilities?.workspace?.configuration)

    defaultBinPath = await util.getBinPath()

    connection.console.info(
      `Default version of Prisma binary 'prisma-fmt': ${util.getVersion()}`,
    )

    connection.console.info(
      // eslint-disable-next-line
      `Extension name ${packageJson.name} with version ${packageJson.version}`,
    )
    const prismaCLIVersion = util.getCLIVersion()
    connection.console.info(`Prisma CLI version: ${prismaCLIVersion}`)

    const result: InitializeResult = {
      capabilities: {
        definitionProvider: true,
        documentFormattingProvider: true,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['@', '"', '.'],
        },
        hoverProvider: true,
        renameProvider: true,
      },
    }

    if (hasCodeActionLiteralsCapability) {
      result.capabilities.codeActionProvider = {
        codeActionKinds: [CodeActionKind.QuickFix],
      }
    }

    return result
  })

  connection.onInitialized(() => {
    if (hasConfigurationCapability) {
      // Register for all configuration changes.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined,
      )
    }
  })

  // The global settings, used when the `workspace/configuration` request is not supported by the client or is not set by the user.
  // This does not apply to VSCode, as this client supports this setting.
  const defaultSettings: LSPSettings = {
    prismaFmtBinPath: defaultBinPath,
  }
  let globalSettings: LSPSettings = defaultSettings

  // Cache the settings of all open documents
  const documentSettings: Map<string, Thenable<LSPSettings>> = new Map<
    string,
    Thenable<LSPSettings>
  >()

  connection.onDidChangeConfiguration((change) => {
    connection.console.info('Configuration changed.')
    if (hasConfigurationCapability) {
      // Reset all cached document settings
      documentSettings.clear()
    } else {
      globalSettings = <LSPSettings>(
        (change.settings.prismaLanguageServer || defaultSettings) // eslint-disable-line @typescript-eslint/no-unsafe-member-access
      )
    }
    documents.all().forEach(async (d) => await installPrismaFmt(d.uri)) // eslint-disable-line @typescript-eslint/no-misused-promises

    // Revalidate all open prisma schemas
    documents.all().forEach(validateTextDocument) // eslint-disable-line @typescript-eslint/no-misused-promises
  })

  // Only keep settings for open documents
  documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri)
  })

  function getDocumentSettings(resource: string): Thenable<LSPSettings> {
    if (!hasConfigurationCapability) {
      connection.console.info(`Using default prisma-fmt binary path.`)
      return Promise.resolve(globalSettings)
    }
    let result = documentSettings.get(resource)
    if (!result) {
      result = connection.workspace.getConfiguration({
        scopeUri: resource,
        section: 'prismaLanguageServer',
      })
      documentSettings.set(resource, result)
    }
    return result
  }

  function getPrismaFmtBinPath(binPathSetting: string): string {
    return binPathSetting.length === 0 ? defaultBinPath : binPathSetting
  }

  async function validateTextDocument(
    textDocument: TextDocument,
  ): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri)
    const fmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    const diagnostics: Diagnostic[] = await MessageHandler.handleDiagnosticsRequest(
      textDocument,
      fmtBinPath,
      (errorMessage: string) => {
        connection.window.showErrorMessage(errorMessage)
      },
    )
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  documents.onDidChangeContent(async (change: { document: TextDocument }) => {
    await validateTextDocument(change.document)
  })

  documents.onDidOpen(async (open: { document: TextDocument }) => {
    await installPrismaFmt(open.document.uri)
    await validateTextDocument(open.document)
  })

  async function installPrismaFmt(documentUri: string) {
    const settings = await getDocumentSettings(documentUri)
    const prismaFmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    if (await util.binaryIsNeeded(prismaFmtBinPath)) {
      try {
        await install(prismaFmtBinPath)
        connection.console.info(
          `Prisma plugin prisma-fmt installation succeeded.`,
        )
        connection.console.info(`Installed 'prisma-fmt': ${prismaFmtBinPath}`)
      } catch (err) {
        sendException(await getSignature(), err, `Cannot install prisma-fmt.`)
        connection.console.error('Cannot install prisma-fmt: ' + err) // eslint-disable-line @typescript-eslint/restrict-plus-operands
      }
    } else {
      connection.console.info(`Installed 'prisma-fmt': ${prismaFmtBinPath}`)
    }
  }

  function getDocument(uri: string): TextDocument | undefined {
    return documents.get(uri)
  }

  connection.onDefinition(async (params: DeclarationParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const definition = MessageHandler.handleDefinitionRequest(doc, params)
      if (definition !== undefined) {
        sendTelemetry({
          action: 'definition',
          attributes: {
            signature: await getSignature(),
          },
        })
      }
      return definition
    }
  })

  connection.onCompletion(async (params: CompletionParams) => {
    const doc = getDocument(params.textDocument.uri)
    const settings = await getDocumentSettings(params.textDocument.uri)
    const prismaFmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    if (doc) {
      return MessageHandler.handleCompletionRequest(
        params,
        doc,
        prismaFmtBinPath,
      )
    }
  })

  connection.onCompletionResolve(async (completionItem: CompletionItem) => {
    sendTelemetry({
      action: 'resolveCompletion',
      attributes: {
        label: completionItem.label,
        signature: await getSignature(),
      },
    })
    return MessageHandler.handleCompletionResolveRequest(completionItem)
  })

  connection.onDidChangeWatchedFiles(() => {
    // Monitored files have changed in VS Code
    connection.console.log(
      `Types have changed. Sending request to restart TS Language Server.`,
    )
    // Restart TS Language Server
    connection.sendNotification('prisma/didChangeWatchedFiles', {})
  })

  connection.onHover(async (params: HoverParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const hover = MessageHandler.handleHoverRequest(doc, params)
      if (hover !== undefined) {
        sendTelemetry({
          action: 'hover',
          attributes: {
            signature: await getSignature(),
          },
        })
      }
      return hover
    }
  })

  connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
    const doc = getDocument(params.textDocument.uri)
    const settings = await getDocumentSettings(params.textDocument.uri)
    const prismaFmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    if (doc) {
      sendTelemetry({
        action: 'format',
        attributes: {
          signature: await getSignature(),
        },
      })
      return MessageHandler.handleDocumentFormatting(
        params,
        doc,
        prismaFmtBinPath,
        (errorMessage: string) => {
          connection.window.showErrorMessage(errorMessage)
        },
      )
    }
  })

  connection.onCodeAction(async (params: CodeActionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const codeActions: CodeAction[] = MessageHandler.handleCodeActions(
        params,
        doc,
      )
      if (codeActions.length !== 0) {
        sendTelemetry({
          action: 'codeAction',
          attributes: {
            signature: await getSignature(),
          },
        })
      }
      return codeActions
    }
  })

  connection.onRenameRequest(async (params: RenameParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const rename = MessageHandler.handleRenameRequest(params, doc)
      if (rename !== undefined) {
        sendTelemetry({
          action: 'rename',
          attributes: {
            signature: await getSignature(),
          },
        })
      }
      return rename
    }
  })

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
