import * as vscode from 'vscode';
import assert from 'assert';
import { getDocUri, activate, toRange } from './helper';
import fs from 'fs'

suite('Should auto-format', () => {
    const docUri = getDocUri('autoFormat.prisma')
    const docUriExpected = getDocUri('correct.prisma')

    const textDocument = fs.readFileSync(docUriExpected.fsPath, 'utf8')

    test('Diagnoses auto-formatting', async () => {
        await testAutoFormatting(docUri, textDocument)
    });
});

async function testAutoFormatting(docUri: vscode.Uri, expectedFormatted: string) {
    await activate(docUri)

    const actualFormatted = (await vscode.commands.executeCommand(
        'vscode.executeFormatDocumentProvider',
        docUri,
        <vscode.FormattingOptions> {insertSpaces: true, tabSize: 2 }
    )) as vscode.TextEdit[]

    const workEdits = new vscode.WorkspaceEdit()
    workEdits.set(docUri, actualFormatted)
    const b = vscode.workspace.applyEdit(workEdits)

    assert.deepEqual(actualFormatted, expectedFormatted)
}