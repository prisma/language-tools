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
import { MessageHandler } from './MessageHandler'
import { fullDocumentRange } from './provider'
import * as util from './util'
import lint from './lint'
//import { getDMMF } from '@prisma/sdk'

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all)

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability: boolean = false
let hasWorkspaceFolderCapability: boolean = false
let hasDiagnosticRelatedInformationCapability: boolean = false

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
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

  const result: InitializeResult = {
    capabilities: {
      // definitionProvider: true,
      //hoverProvider: true,
      documentFormattingProvider: true
    },
  }

  return result
})

const messageHandler = new MessageHandler()

 connection.onDocumentFormatting(params =>
  messageHandler.handleDocumentFormatting(params, documents),
) 

documents.onDidChangeContent(change => {
  validateTextDocument(change.document)
})

documents.onDidOpen(open => {
  validateTextDocument(open.document)
}) 

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText(fullDocumentRange(textDocument))
  const binPath = await util.getBinPath()
  const res = await lint(binPath, text)
  let diagnostics: Diagnostic[] = []

  for (const error of res) {
    let diagnostic: Diagnostic = {
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
        // send related Information such as location and message
      ]
    }
    diagnostics.push(diagnostic)
  }
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}


// connection.onHover(params => messageHandler.handleHoverRequest(params, documents))
 
//connection.onDefinition(params =>
//  messageHandler.handleDefinitionRequest(params),
//) 

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()
