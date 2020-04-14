import PrismaEditProvider, { fullDocumentRange } from './provider'
import * as vscode from 'vscode'
import install from './install'
import * as util from './util'
import * as fs from 'fs'
import lint from './lint'
import * as path from 'path'
//import { getDMMF } from '@prisma/sdk'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'

let client: LanguageClient

export async function activate(context: vscode.ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js'),
  )
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'prisma' }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc'),
    },
  }

  // Create the language client and start the client.
  client = new LanguageClient(
    'lsp-prisma-client',
    'Prisma Language Server',
    serverOptions,
    clientOptions,
  )

  // Start the client. This will also launch the server
  client.start()

  const binPath = await util.getBinPath()
  if (!fs.existsSync(binPath)) {
    try {
      await install(binPath)
      vscode.window.showInformationMessage(
        'Prisma plugin installation succeeded.',
      )
    } catch (err) {
      // No error on install error.
      // vscode.window.showErrorMessage("Cannot install prisma-fmt: " + err)
    }
  }

  if (fs.existsSync(binPath)) {
    // This registers our formatter, prisma-fmt
    vscode.languages.registerDocumentFormattingEditProvider(
      'prisma',
      new PrismaEditProvider(binPath),
    )

    // This registers our linter, also prisma-fmt for now.
    const collection = vscode.languages.createDiagnosticCollection('prisma')

    vscode.workspace.onDidChangeTextDocument(async e => {
      await updatePrismaDiagnostics(e.document, collection)
    })
    if (vscode.window.activeTextEditor) {
      await updatePrismaDiagnostics(
        vscode.window.activeTextEditor.document,
        collection,
      )
    }
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(async editor => {
        if (editor) {
          await updatePrismaDiagnostics(editor.document, collection)
        }
      })
    )
  }
}

async function updatePrismaDiagnostics(
  document: vscode.TextDocument,
  collection: vscode.DiagnosticCollection,
) {
  // ignore for non-prisma files
  if (!document || document.languageId !== 'prisma') {
    collection.clear()
    return
  }

  const text = document.getText(fullDocumentRange(document))
  const binPath = await util.getBinPath()
  const res = await lint(binPath, text)
  const errors = []

  for (const error of res) {
    errors.push({
      code: '',
      message: error.text,
      range: new vscode.Range(
        document.positionAt(error.start),
        document.positionAt(error.end),
      ),
      severity: vscode.DiagnosticSeverity.Error,
      source: '',
      relatedInformation: [],
    })
  }
  collection.set(document.uri, errors)
}



