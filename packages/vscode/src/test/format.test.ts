import vscode from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from './helper'
import fs from 'fs'

async function testAutoFormat(
  docUri: vscode.Uri,
  expectedFormatted: string,
): Promise<void> {
  await activate(docUri)

  const actualFormatted = (await vscode.commands.executeCommand(
    'vscode.executeFormatDocumentProvider',
    docUri,
    { insertSpaces: true, tabSize: 2 },
  )) as vscode.TextEdit[]

  const workEdits = new vscode.WorkspaceEdit()
  workEdits.set(docUri, actualFormatted)
  await vscode.workspace.applyEdit(workEdits)
  const document = await vscode.workspace.openTextDocument(docUri)
  const actualResult = document.getText()

  assert.strictEqual(actualResult, expectedFormatted)
}

suite('Should auto-format', () => {
  const docUri = getDocUri('formatting/autoFormat.prisma')

  const docUriExpected = getDocUri('correct.prisma')
  const textDocument = fs.readFileSync(docUriExpected.fsPath, 'utf8')

  test('Diagnoses auto-format', async () => {
    await testAutoFormat(docUri, textDocument)
  })
})
