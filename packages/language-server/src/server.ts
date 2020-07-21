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
} from 'vscode-languageserver'
import { getSignature } from 'checkpoint-client'
import { sendTelemetry, sendException, initializeTelemetry } from './telemetry'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as MessageHandler from './MessageHandler'
import * as util from './util'
import install from './install'

export interface LSOptions {
  /**
   * If you have a connection already that the ls should use, pass it in.
   * Else the connection will be created from `process`.
   */
  connection?: IConnection
}

function getConnection(options?: LSOptions): IConnection {
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

/**
 * Starts the language server.
 *
 * @param options Options to customize behavior
 */
export function startServer(options?: LSOptions): void {
  const connection: IConnection = getConnection(options)
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

  // Does the clients accepts diagnostics with related information?
  let hasCodeActionLiteralsCapability = false

  connection.onInitialize(async (params: InitializeParams) => {
    initializeTelemetry(connection)
    const capabilities = params.capabilities

    hasCodeActionLiteralsCapability = Boolean(
      capabilities?.textDocument?.codeAction?.codeActionLiteralSupport,
    )

    const binPathPrismaFmt = await util.getBinPath()
    if (await util.binaryIsNeeded(binPathPrismaFmt)) {
      try {
        await install(binPathPrismaFmt)
        connection.console.info(
          'Prisma plugin prisma-fmt installation succeeded.',
        )
      } catch (err) {
        sendException(await getSignature(), err, 'Cannot install prisma-fmt.')
        connection.console.error('Cannot install prisma-fmt: ' + err)
      }
    }

    connection.console.info(
      'Installed version of Prisma binary `prisma-fmt`: ' +
        (await util.getVersion()),
    )

    const pj = util.tryRequire('../../package.json')
    connection.console.info(
      'Extension name ' + pj.name + ' with version ' + pj.version,
    )
    const prismaCLIVersion = await util.getCLIVersion()
    connection.console.info('Prisma CLI version: ' + prismaCLIVersion)

    const result: InitializeResult = {
      capabilities: {
        definitionProvider: true,
        documentFormattingProvider: true,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['@', '"'],
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

  async function validateTextDocument(
    textDocument: TextDocument,
  ): Promise<void> {
    const diagnostics: Diagnostic[] = await MessageHandler.handleDiagnosticsRequest(
      textDocument,
      (errorMessage: string) => {
        connection.window.showErrorMessage(errorMessage)
      },
    )
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  documents.onDidChangeContent((change: { document: TextDocument }) => {
    validateTextDocument(change.document)
  })

  documents.onDidOpen((open: { document: TextDocument }) => {
    validateTextDocument(open.document)
  })

  function getDocument(uri: string): TextDocument | undefined {
    return documents.get(uri)
  }

  connection.onDefinition((params: DeclarationParams) => {
    const doc = getDocument(params.textDocument.uri)
    sendTelemetry({
      action: 'definition',
      attributes: {
        signature: getSignature(),
      },
    })
    if (doc) {
      return MessageHandler.handleDefinitionRequest(doc, params)
    }
  })

  connection.onCompletion((params: CompletionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleCompletionRequest(params, doc)
    }
  })

  connection.onCompletionResolve((completionItem: CompletionItem) => {
    sendTelemetry({
      action: 'resolveCompletion',
      attributes: {
        label: completionItem.label,
        signature: getSignature(),
      },
    })
    return MessageHandler.handleCompletionResolveRequest(completionItem)
  })

  connection.onHover((params: HoverParams) => {
    sendTelemetry({
      action: 'hover',
      attributes: {
        signature: getSignature(),
      },
    })
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      return MessageHandler.handleHoverRequest(doc, params)
    }
  })

  connection.onDocumentFormatting((params: DocumentFormattingParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      sendTelemetry({
        action: 'format',
        attributes: {
          signature: getSignature(),
        },
      })
      return MessageHandler.handleDocumentFormatting(
        params,
        doc,
        (errorMessage: string) => {
          connection.window.showErrorMessage(errorMessage)
        },
      )
    }
  })

  connection.onCodeAction((params: CodeActionParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      sendTelemetry({
        action: 'codeAction',
        attributes: {
          signature: getSignature(),
        },
      })
      return MessageHandler.handleCodeActions(params, doc)
    }
  })

  connection.onRenameRequest((params: RenameParams) => {
    const doc = getDocument(params.textDocument.uri)
    if (doc) {
      sendTelemetry({
        action: 'rename',
        attributes: {
          signature: getSignature(),
        },
      })
      return MessageHandler.handleRenameRequest(params, doc)
    }
  })

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
