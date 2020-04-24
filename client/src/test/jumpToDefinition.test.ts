import vscode from 'vscode';
import assert from 'assert';
import { getDocUri, activate, toRange, sleep } from './helper';

suite('Should jump-to-definition', () => {
    const docUri = getDocUri('correct.prisma')

    test('Diagnoses jump from attribute to model', async () => {
        await testJumpToDefinition(docUri, new vscode.Position(22, 9), new vscode.Location(docUri, toRange(9, 6, 9, 10)))
        await testJumpToDefinition(docUri, new vscode.Position(14, 14), new vscode.Location(docUri, toRange(18, 6, 18, 10)))
    });
});

async function testJumpToDefinition(docUri: vscode.Uri, position: vscode.Position, expectedLocation: vscode.Location) {
    await activate(docUri)

    const actualLocation: vscode.Location[] = (await vscode.commands.executeCommand(
        'vscode.executeDefinitionProvider',
        docUri,
        position
    )) as vscode.Location[]

    assert.ok(actualLocation.length === 1)
    assert.deepEqual(actualLocation[0].range, expectedLocation.range)
}