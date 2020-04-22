import * as vscode from 'vscode';
import * as assert from 'assert';
import { getDocUri, activate } from './helper';

suite('Should jump-to-definition', () => {
    const docUri = getDocUri('correct.prisma')

    test('Diagnoses jump from attribute to model', async () => {
        await testJumpToDefinition(docUri, new vscode.Position(22, 9), new vscode.Location(docUri, toRange(9, 6, 9, 10)))
        await testJumpToDefinition(docUri, new vscode.Position(14, 14), new vscode.Location(docUri, toRange(18, 6, 18, 10)))
    });
});

function toRange(sLine: number, sChar: number, eLine: number, eChar: number) {
    const start = new vscode.Position(sLine, sChar);
    const end = new vscode.Position(eLine, eChar);
    return new vscode.Range(start, end);
}

async function testJumpToDefinition(docUri: vscode.Uri, position: vscode.Position, expectedLocation: vscode.Location) {
    await activate(docUri)

    const actualLocation = (await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        docUri,
        position
    )) as vscode.Location[]

    assert.ok(actualLocation.length === 1)
    assert.deepEqual(actualLocation[0].range, expectedLocation.range)
}