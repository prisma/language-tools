import vscode from 'vscode'
import assert from 'assert'
import { getDocUri, activate, toRange } from './helper'

async function testJumpToDefinition(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedLocation: vscode.Location,
): Promise<void> {
  const actualLocation: vscode.Location[] = (await vscode.commands.executeCommand(
    'vscode.executeDefinitionProvider',
    docUri,
    position,
  )) as vscode.Location[]

  assert.ok(actualLocation.length === 1)
  assert.deepStrictEqual(actualLocation[0].range, expectedLocation.range)
}

suite('Should jump-to-definition', () => {
  const docUri = getDocUri('correct.prisma')

  test('Diagnoses jump from attribute to model', async () => {
    await activate(docUri)

    await testJumpToDefinition(
      docUri,
      new vscode.Position(22, 9),
      new vscode.Location(docUri, toRange(9, 0, 16, 1)),
    )
    await testJumpToDefinition(
      docUri,
      new vscode.Position(14, 14),
      new vscode.Location(docUri, toRange(18, 0, 24, 1)),
    )
    await testJumpToDefinition(
      docUri,
      new vscode.Position(11, 16),
      new vscode.Location(docUri, toRange(26, 0, 31, 1)),
    )
  })
})
