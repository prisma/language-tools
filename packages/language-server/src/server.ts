import {
  TextDocuments,
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
  DidChangeConfigurationNotification,
  Connection,
  DocumentSymbolParams,
  ReferenceParams,
} from 'vscode-languageserver'
import { createConnection, IPCMessageReader, IPCMessageWriter } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import * as MessageHandler from './lib/MessageHandler'
import type { LSOptions, LSSettings } from './lib/types'
import { getVersion, getEnginesVersion, getCliVersion } from './lib/prisma-schema-wasm/internals'
import { PrismaSchema } from './lib/Schema'

const packageJson = require('../package.json') // eslint-disable-line

function getConnection(options?: LSOptions): Connection {
  let connection = options?.connection
  if (!connection) {
    connection = process.argv.includes('--stdio')
      ? createConnection(process.stdin, process.stdout)
      : createConnection(new IPCMessageReader(process), new IPCMessageWriter(process))
  }
  return connection
}

let hasCodeActionLiteralsCapability = false
let hasConfigurationCapability = false

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSOptions): void {
  // Source code: https://github.com/microsoft/vscode-languageserver-node/blob/main/server/src/common/server.ts#L1044
  const connection: Connection = getConnection(options)

  console.log = connection.console.log.bind(connection.console)
  console.error = connection.console.error.bind(connection.console)

  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

  connection.onInitialize((params: InitializeParams) => {
    // Logging first...
    connection.console.info(`Default version of Prisma 'prisma-schema-wasm': ${getVersion()}`)

    connection.console.info(
      // eslint-disable-next-line
      `Extension name ${packageJson.name} with version ${packageJson.version}`,
    )
    const prismaEnginesVersion = getEnginesVersion()
    connection.console.info(`Prisma Engines version: ${prismaEnginesVersion}`)
    const prismaCliVersion = getCliVersion()
    connection.console.info(`Prisma CLI version: ${prismaCliVersion}`)

    // ... and then capabilities of the language server
    const capabilities = params.capabilities

    hasCodeActionLiteralsCapability = Boolean(capabilities?.textDocument?.codeAction?.codeActionLiteralSupport)
    hasConfigurationCapability = Boolean(capabilities?.workspace?.configuration)

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
        documentSymbolProvider: true,
        referencesProvider: true,
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
      connection.client.register(DidChangeConfigurationNotification.type, undefined)
    }
  })

  // The global settings, used when the `workspace/configuration` request is not supported by the client or is not set by the user.
  // This does not apply to VS Code, as this client supports this setting.
  // const defaultSettings: LSSettings = {}
  // let globalSettings: LSSettings = defaultSettings // eslint-disable-line

  // Cache the settings of all open documents
  const documentSettings: Map<string, Thenable<LSSettings>> = new Map<string, Thenable<LSSettings>>()

  connection.onDidChangeConfiguration((_change) => {
    connection.console.info('Configuration changed.')
    if (hasConfigurationCapability) {
      // Reset all cached document settings
      documentSettings.clear()
    } else {
      // globalSettings = <LSSettings>(change.settings.prisma || defaultSettings) // eslint-disable-line @typescript-eslint/no-unsafe-member-access
    }

    // Revalidate all open prisma schemas
    documents.all().forEach(validateTextDocument) // eslint-disable-line @typescript-eslint/no-misused-promises
  })

  // Only keep settings for open documents
  documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri)
  })

  function getDocumentSettings(resource: string): Thenable<LSSettings> {
    if (!hasConfigurationCapability) {
      connection.console.info(`hasConfigurationCapability === false. Defaults will be used.`)
      return Promise.resolve({})
    }

    let result = documentSettings.get(resource)
    if (!result) {
      result = connection.workspace.getConfiguration({
        scopeUri: resource,
        section: 'prisma',
      })
      documentSettings.set(resource, result)
    }
    return result
  }

  // Note: VS Code strips newline characters from the message
  function showErrorToast(errorMessage: string): void {
    connection.window.showErrorMessage(errorMessage)
  }

  async function validateTextDocument(textDocument: TextDocument) {
    const settings = await getDocumentSettings(textDocument.uri)

    if (settings.enableDiagnostics === false) {
      await connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] })
      return
    }

    const schema = await PrismaSchema.load(textDocument, documents)
    const diagnostics = MessageHandler.handleDiagnosticsRequest(schema, showErrorToast)
    for (const [uri, fileDiagnostics] of diagnostics.entries()) {
      await connection.sendDiagnostics({ uri, diagnostics: fileDiagnostics })
    }
  }

  documents.onDidChangeContent(async (change: { document: TextDocument }) => {
    await validateTextDocument(change.document)
  })

  function getDocument(uri: string): TextDocument | undefined {
    return documents.get(uri)
  }

  connection.onDefinition(async (params: DeclarationParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleDefinitionRequest(schema, doc, params)
    }
  })

  connection.onCompletion(async (params: CompletionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleCompletionRequest(schema, doc, params, showErrorToast)
    }
  })

  connection.onReferences(async (params: ReferenceParams) => {
    const doc = getDocument(params.textDocument.uri)

    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)

      return MessageHandler.handleReferencesRequest(schema, params, showErrorToast)
    }
  })

  // This handler resolves additional information for the item selected in the completion list.
  connection.onCompletionResolve((completionItem: CompletionItem) => {
    return MessageHandler.handleCompletionResolveRequest(completionItem)
  })

  // Unused now
  // TODO remove or experiment new file watcher
  connection.onDidChangeWatchedFiles(() => {
    // Monitored files have changed in VS Code
    connection.console.log(`Types have changed. Sending request to restart TS Language Server.`)
    // Restart TS Language Server
    void connection.sendNotification('prisma/didChangeWatchedFiles', {})
  })

  connection.onHover(async (params: HoverParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleHoverRequest(schema, doc, params, showErrorToast)
    }
  })

  connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleDocumentFormatting(schema, doc, params, showErrorToast)
    }
  })

  connection.onCodeAction(async (params: CodeActionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleCodeActions(schema, doc, params, showErrorToast)
    }
  })

  connection.onRenameRequest(async (params: RenameParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      const schema = await PrismaSchema.load(doc, documents)
      return MessageHandler.handleRenameRequest(schema, doc, params)
    }
  })

  connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleDocumentSymbol(params, doc)
    }
  })

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
