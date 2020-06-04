import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
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

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager. The text document manager
// supports full document sync only.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false
let hasDiagnosticRelatedInformationCapability = false

connection.onInitialize(async (params: InitializeParams) => {
  const capabilities = params.capabilities

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  )
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  )
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  )

  const binPathPrismaFmt = await util.getBinPath()
  if (!fs.existsSync(binPathPrismaFmt)) {
    try {
      await install(binPathPrismaFmt)
      connection.console.info(
        'Prisma plugin prisma-fmt installation succeeded.',
      )
    } catch (err) {
      // No error on install error.
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

  return result
})

connection.onDocumentFormatting((params) =>
  MessageHandler.handleDocumentFormatting(
    params,
    documents,
    (errorMessage: string) => {
      connection.window.showErrorMessage(errorMessage)
    },
  ),
)

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
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
    if (hasDiagnosticRelatedInformationCapability) {
      diagnostic.relatedInformation = [
        // could send related information such as location and message
      ]
    }
    diagnostics.push(diagnostic)
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document)
})

documents.onDidOpen((open) => {
  validateTextDocument(open.document)
})

connection.onDefinition((params) =>
  MessageHandler.handleDefinitionRequest(documents, params),
)

connection.onCompletion((params) =>
  MessageHandler.handleCompletionRequest(params, documents),
)

connection.onCompletionResolve((params) =>
  MessageHandler.handleCompletionResolveRequest(params),
)

connection.onHover((params) =>
  MessageHandler.handleHoverRequest(documents, params),
)

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()
