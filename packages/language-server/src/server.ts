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
} from 'vscode-languageserver'
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
export function startServer(options?: LSOptions) {
  const connection: IConnection = getConnection(options)
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

  // Does the clients accepts diagnostics with related information?
  let hasCodeActionLiteralsCapability: boolean = false

  connection.onInitialize(async (params: InitializeParams) => {
    const capabilities = params.capabilities

    hasCodeActionLiteralsCapability = Boolean(capabilities?.textDocument?.codeAction?.codeActionLiteralSupport)

    const binPathPrismaFmt = await util.getBinPath()
    if (!fs.existsSync(binPathPrismaFmt)) {
      try {
        await install(binPathPrismaFmt)
        connection.console.info(
          'Prisma plugin prisma-fmt installation succeeded.',
        )
      } catch (err) {
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
      connection.window.showErrorMessage(
        "You are currently viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma VSCode extension doesn't support this syntax. To get proper syntax highlighting for this file, please change the file extension to `.graphql` and download the [GraphQL VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.vscode-graphql). Learn more [here](https://pris.ly/prisma1-vscode).",
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

  documents.onDidChangeContent((change: { document: any }) => {
    validateTextDocument(change.document)
  })

  documents.onDidOpen((open: { document: any }) => {
    validateTextDocument(open.document)
  })

  connection.onDefinition((params: any) =>
    MessageHandler.handleDefinitionRequest(documents, params),
  )

  connection.onCompletion((params: any) =>
    MessageHandler.handleCompletionRequest(params, documents),
  )

  connection.onCompletionResolve((params: any) =>
    MessageHandler.handleCompletionResolveRequest(params),
  )

  connection.onHover((params: any) =>
    MessageHandler.handleHoverRequest(documents, params),
  )

  connection.onDocumentFormatting((params: any) =>
    MessageHandler.handleDocumentFormatting(
      params,
      documents,
      (errorMessage: string) => {
        connection.window.showErrorMessage(errorMessage)
      },
    ),
  )

  connection.onCodeAction((params: CodeActionParams) =>
    MessageHandler.handleCodeActions(params, documents),
  )

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection)

  connection.listen()
}
