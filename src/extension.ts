import PrismaEditProvider, { fullDocumentRange } from './provider'
import * as vscode from 'vscode'
import install from './install'
import * as util from './util'
import * as fs from 'fs'
import lint from './lint'

export async function activate(context: vscode.ExtensionContext) {
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
      }),
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
