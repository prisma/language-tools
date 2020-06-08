import {
  IConnection,
  TextDocuments,
  DiagnosticSeverity,
  Diagnostic,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as MessageHandler from './MessageHandler'
import { fullDocumentRange } from './provider'
import * as util from './util'
import lint from './lint'
import fs from 'fs'
import install from './install'

export class PLS {
  public static start(connection: IConnection) {
    return new PLS(connection)
  }

  private documents: TextDocuments<TextDocument> = new TextDocuments(
    TextDocument,
  )

  private validationDelayMs = 800
  private pendingValidationRequests: {
    [uri: string]: ReturnType<typeof setTimeout>
  } = {}

  constructor(private connection: IConnection) {
    this.connection = connection

    // Make the text document manager listen on the connection
    // for open, change and close text document events
    this.documents.listen(connection)

    // Listen on the connection
    connection.listen()

    this.documents.onDidChangeContent((change) =>
      this.queueValidation(change.document)

    )

    this.documents.onDidOpen((change) =>
      this.queueValidation(change.document)
    )

    connection.onInitialize(async () => {

      connection.onDocumentFormatting((params) => MessageHandler.handleDocumentFormatting(
        params,
        this.documents,
        (errorMessage: string) => {
          connection.window.showErrorMessage(errorMessage)
        },
      ))

      connection.onDefinition((params) =>
        MessageHandler.handleDefinitionRequest(this.documents, params)
      )

      connection.onCompletion((params) =>
        MessageHandler.handleCompletionRequest(params, this.documents)
      )

      connection.onCompletionResolve((params) =>
        MessageHandler.handleCompletionResolveRequest(params)
      )

      connection.onHover((params) =>
        MessageHandler.handleHoverRequest(this.documents, params)
      )


      this.documents.all().forEach((doc) => this.queueValidation(doc))

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

      return {
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
    })
  }

  public async validateTextDocument(
    textDocument: TextDocument,
  ): Promise<Diagnostic[]> {
    const text = textDocument.getText(fullDocumentRange(textDocument))
    const binPath = await util.getBinPath()

    const res = await lint(binPath, text, (errorMessage: string) => {
      this.connection.window.showErrorMessage(errorMessage)
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
      this.connection.window.showErrorMessage(
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
    return diagnostics
  }


  private async queueValidation(textDocument: TextDocument): Promise<void> {
    const previousRequest = this.pendingValidationRequests[textDocument.uri]
    if (previousRequest) {
      clearTimeout(previousRequest)
      delete this.pendingValidationRequests[textDocument.uri]
    }

    this.pendingValidationRequests[textDocument.uri] = setTimeout(async () => {
      delete this.pendingValidationRequests[textDocument.uri]
      this.connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: await this.validateTextDocument(textDocument),
      })
    }, this.validationDelayMs)
  }

}
