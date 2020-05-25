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
import path from 'path'
import { download } from '@prisma/fetch-engine'

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

  const sdkQueryEnginePath = await util.getSdkQueryEnginePath()
  if (!fs.existsSync(sdkQueryEnginePath)) {
    try {
      const sdkDir = path.dirname(require.resolve('@prisma/sdk/package.json'))
      await download({
        binaries: {
          'query-engine': sdkDir,
        },
        failSilent: false,
      })
    } catch (err) {
      // No error on install error.
      connection.console.error('Cannot install prisma query-engine: ' + err)
    }
  }

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

  const pj = require('../../package.json')
  connection.console.info(
    'Extension name ' + pj.name + ' with version ' + pj.version
  )

  const result: InitializeResult = {
    capabilities: {
      definitionProvider: true,
      documentFormattingProvider: true,
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

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection)

// Listen on the connection
connection.listen()
