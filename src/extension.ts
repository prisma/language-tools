import PrismaEditProvider, { fullDocumentRange } from './provider'
import { getPlatform, Platform } from '@prisma/get-platform'
import * as vscode from 'vscode'
import install from './install'
import * as path from 'path'
import * as fs from 'fs'
import lint from './lint'

function getExecPath(platform: Platform): string {
  const extension = platform === 'windows' ? '.exe' : ''
  return path.join(__dirname, '..', `prisma-fmt${extension}`)
}

export async function activate(context: vscode.ExtensionContext) {
  const platform = await getPlatform()
  const execPath = getExecPath(platform)

  if (!fs.existsSync(execPath)) {
    try {
      await install(execPath)
      vscode.window.showInformationMessage(
        'Prisma plugin installation succeeded.',
      )
    } catch (err) {
      // No error on install error.
      // vscode.window.showErrorMessage("Cannot install prisma-fmt: " + err)
    }
  }

  if (fs.existsSync(execPath)) {
    // This registers our formatter, prisma-fmt
    vscode.languages.registerDocumentFormattingEditProvider(
      'prisma',
      new PrismaEditProvider(execPath),
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
  const platform = await getPlatform()
  const execPath = getExecPath(platform)

  const res = await lint(execPath, text)
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
