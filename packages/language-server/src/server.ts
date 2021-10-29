import {
  TextDocuments,
  Diagnostic,
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
} from 'vscode-languageserver'
import {
  createConnection,
  IPCMessageReader,
  IPCMessageWriter,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as MessageHandler from './MessageHandler'
import * as util from './prisma-fmt/util'
import install from './prisma-fmt/install'
import { LSPOptions, LSPSettings } from './settings'
import { existsSync } from 'fs'
const packageJson = require('../../package.json') // eslint-disable-line

function getConnection(options?: LSPOptions): Connection {
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

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSPOptions): void {
  const connection: Connection = getConnection(options)

  console.log = connection.console.log.bind(connection.console)
  console.error = connection.console.error.bind(connection.console)

  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
  let defaultBinPath = ''

  connection.onInitialize(async (params: InitializeParams) => {
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
    const prismaEnginesVersion = util.getEnginesVersion()
    connection.console.info(`Prisma Engines version: ${prismaEnginesVersion}`)
    const prismaCliVersion = util.getCliVersion()
    connection.console.info(`Prisma CLI version: ${prismaCliVersion}`)

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
      globalSettings = <LSPSettings>(change.settings.prisma || defaultSettings) // eslint-disable-line @typescript-eslint/no-unsafe-member-access
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
        section: 'prisma',
      })
      documentSettings.set(resource, result)
    }
    return result
  }

  function getPrismaFmtBinPath(binPathSetting: string | undefined): string {
    if (!binPathSetting || binPathSetting.length === 0) {
      return defaultBinPath
    } else if (!existsSync(binPathSetting)) {
      connection.window.showErrorMessage(
        `Path to prisma-fmt binary (${binPathSetting}) does not exist. Using default prisma-fmt binary path instead.`,
      )
      return defaultBinPath
    } else {
      connection.console.log(
        'Using binary path from Prisma Language Server configuration.',
      )
      return binPathSetting
    }
  }

  async function validateTextDocument(
    textDocument: TextDocument,
  ): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri)
    const fmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    const diagnostics: Diagnostic[] =
      await MessageHandler.handleDiagnosticsRequest(
        textDocument,
        fmtBinPath,
        (errorMessage: string) => {
          connection.window.showErrorMessage(errorMessage)
        },
      )
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  documents.onDidChangeContent(async (change: { document: TextDocument }) => {
    await installPrismaFmt(change.document.uri)
    await validateTextDocument(change.document)
  })

  async function installPrismaFmt(documentUri: string) {
    const settings = await getDocumentSettings(documentUri)
    const prismaFmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    connection.console.info(`Local prisma-fmt path: ${prismaFmtBinPath}`)

    const isInstallNecessary = util.binaryIsNeeded(prismaFmtBinPath)
    if (
      isInstallNecessary ||
      (!isInstallNecessary && !(await util.testBinarySuccess(prismaFmtBinPath)))
    ) {
      const downloadUrl = await util.getDownloadURL()
      connection.console.info(`Downloading prisma-fmt from ${downloadUrl}`)

      try {
        await install(downloadUrl, prismaFmtBinPath)
        const version = await util.getBinaryVersion(prismaFmtBinPath)
        connection.console.info(
          `Prisma plugin prisma-fmt installation succeeded.`,
        )
        connection.console.info(
          `Installed version ${version} of 'prisma-fmt' using path: ${prismaFmtBinPath}`,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : `${err}` // eslint-disable-line @typescript-eslint/restrict-template-expressions
        connection.console.error(
          `Cannot install prisma-fmt: ${message}. Please:\n` +
            '1. Check your network connection and run `Prisma: Restart Language Server`, or\n' +
            '2. Manually download and uncompress the archive file, then set the path in `prisma.prismaFmtBinPath`\n\n' +
            `The achieve file can be acquired at:\n  ${downloadUrl}\n\n`,
        )
      }
    }
  }

  function getDocument(uri: string): TextDocument | undefined {
    return documents.get(uri)
  }

  connection.onDefinition((params: DeclarationParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleDefinitionRequest(doc, params)
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

  // This handler resolves additional information for the item selected in the completion list.
  connection.onCompletionResolve((completionItem: CompletionItem) => {
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

  connection.onHover((params: HoverParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleHoverRequest(doc, params)
    }
  })

  connection.onDocumentFormatting(async (params: DocumentFormattingParams) => {
    const doc = getDocument(params.textDocument.uri)
    const settings = await getDocumentSettings(params.textDocument.uri)
    const prismaFmtBinPath = getPrismaFmtBinPath(settings.prismaFmtBinPath)
    if (doc) {
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

  connection.onCodeAction((params: CodeActionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleCodeActions(params, doc)
    }
  })

  connection.onRenameRequest((params: RenameParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleRenameRequest(params, doc)
    }
  })

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
