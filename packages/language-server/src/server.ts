import {
  IConnection,
  TextDocuments,
  DiagnosticSeverity,
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
  DocumentFormattingParams,
} from 'vscode-languageserver'
import { getSignature } from 'checkpoint-client'
import { sendTelemetry, sendException, initializeTelemetry } from './telemetry'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as MessageHandler from './MessageHandler'
import { fullDocumentRange } from './provider'
import * as util from './util'
import lint from './lint'
import fs from 'fs'
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
    if (!fs.existsSync(binPathPrismaFmt)) {
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
    const text = textDocument.getText(fullDocumentRange(textDocument))
    const binPath = await util.getBinPath()

    const res = await lint(binPath, text, (errorMessage: string) => {
      connection.window.showErrorMessage(errorMessage)
    })

    const diagnostics: Diagnostic[] = []
    if (
      res.some(
        (err) =>
          err.text === "Field declarations don't require a `:`." ||
          err.text ===
            'Model declarations have to be indicated with the `model` keyword.',
      )
    ) {
      sendTelemetry({
        action: 'Prisma 1 datamodel',
        attributes: {},
      })
      connection.window.showErrorMessage(
        "You are currently viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma Language Server doesn't support this syntax. Please change the file extension to `.graphql` so the Prisma Language Server does not get triggered anymore.",
      )
    }

    for (const error of res) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(error.start),
          end: textDocument.positionAt(error.end),
        },
        message: error.text,
        source: '',
      }
      diagnostics.push(diagnostic)
    }
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  documents.onDidChangeContent((change: { document: TextDocument }) => {
    validateTextDocument(change.document)
  })

  documents.onDidOpen((open: { document: TextDocument }) => {
    validateTextDocument(open.document)
  })

  connection.onDefinition((params: DeclarationParams) => {
    sendTelemetry({
      action: 'definition',
      attributes: {},
    })
    return MessageHandler.handleDefinitionRequest(documents, params)
  })

  connection.onCompletion((params: CompletionParams) =>
    MessageHandler.handleCompletionRequest(params, documents),
  )

  connection.onCompletionResolve((completionItem: CompletionItem) => {
    sendTelemetry({
      action: 'resolveCompletion',
      attributes: {
        label: completionItem.label,
      },
    })
    return MessageHandler.handleCompletionResolveRequest(completionItem)
  })

  connection.onHover((params: HoverParams) => {
    sendTelemetry({
      action: 'hover',
      attributes: {},
    })
    return MessageHandler.handleHoverRequest(documents, params)
  })

  connection.onDocumentFormatting((params: DocumentFormattingParams) => {
    sendTelemetry({
      action: 'format',
      attributes: {},
    })
    return MessageHandler.handleDocumentFormatting(
      params,
      documents,
      (errorMessage: string) => {
        connection.window.showErrorMessage(errorMessage)
      },
    )
  })

  connection.onCodeAction((params: CodeActionParams) => {
    sendTelemetry({
      action: 'codeAction',
      attributes: {},
    })
    return MessageHandler.handleCodeActions(params, documents)
  })

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
