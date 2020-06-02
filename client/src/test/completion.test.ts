import vscode, { CompletionList } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from './helper'

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: CompletionList,
  triggerCharacter?: string,
): Promise<void> {
  await activate(docUri)

  const actualCompletions: vscode.CompletionList = (await vscode.commands.executeCommand(
    'vscode.executeCompletionItemProvider',
    docUri,
    position,
    triggerCharacter
  )) as vscode.CompletionList

  assert.deepStrictEqual(actualCompletions.isIncomplete, expectedCompletionList.isIncomplete)
  assert.deepStrictEqual(actualCompletions.items.length, expectedCompletionList.items.length)
  assert.deepStrictEqual(actualCompletions.items.map(items => items.label), expectedCompletionList.items.map(items => items.label))
  assert.deepStrictEqual(actualCompletions.items.map(item => item.kind), expectedCompletionList.items.map(item => item.kind))
}

suite('Should auto-complete', () => {
  const emptyDocUri = getDocUri('completions/empty.prisma')

  // ALL BLOCKS

  test('Diagnoses block type suggestions for empty file', async () => {
    await testCompletion(
      emptyDocUri,
      new vscode.Position(0, 0),
      new vscode.CompletionList([
        { label: 'datasource', kind: vscode.CompletionItemKind.Class },
        { label: 'enum', kind: vscode.CompletionItemKind.Class },
        { label: 'generator', kind: vscode.CompletionItemKind.Class },
        { label: 'model', kind: vscode.CompletionItemKind.Class },
        { label: 'type_alias', kind: vscode.CompletionItemKind.Class },
      ], false)
    )
  })

  const sqliteDocUri = getDocUri('completions/datasourceWithSqlite.prisma')
  test('Diagnoses block type suggestions with sqlite as provider', async () => {
    await testCompletion(
      sqliteDocUri,
      new vscode.Position(4, 0),
      new vscode.CompletionList([
        { label: 'datasource', kind: vscode.CompletionItemKind.Class },
        { label: 'generator', kind: vscode.CompletionItemKind.Class },
        { label: 'model', kind: vscode.CompletionItemKind.Class },
        { label: 'type_alias', kind: vscode.CompletionItemKind.Class },
      ], false)
    )
  })

  // DATASOURCE BLOCK

  const fieldProvider = { label: 'provider', kind: vscode.CompletionItemKind.Field }
  const fieldUrl = { label: 'url', kind: vscode.CompletionItemKind.Field }
  const dataSourceAndGeneratorEmptyDocUri = getDocUri('completions/emptyDatasourceAndGenerator.prisma')
  test('Diagnoses datasource field suggestions in empty block', async () => {
    await testCompletion(
      dataSourceAndGeneratorEmptyDocUri,
      new vscode.Position(1, 0),
      new vscode.CompletionList([
        fieldProvider,
        fieldUrl
      ])
    )
  })

  test('Diagnoses datasource field suggestions with existing provider', async () => {
    await testCompletion(
      sqliteDocUri,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        fieldUrl
      ])
    )
  })

  const dataSourceWithUrl = getDocUri('completions/datasourceWithUrl.prisma')
  test('Diagnoses datasource field suggestions with existing url', async () => {
    await testCompletion(
      dataSourceWithUrl,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        fieldProvider
      ])
    )
  })

  // GENERATOR BLOCK

  const fieldOutput = { label: 'output', kind: vscode.CompletionItemKind.Field }
  const fieldPlatforms = { label: 'platforms', kind: vscode.CompletionItemKind.Field }
  const fieldPinnedPlatform = { label: 'pinnedPlatform', kind: vscode.CompletionItemKind.Field }
  test('Diagnoses generator field suggestions in empty block', async () => {
    await testCompletion(
      dataSourceAndGeneratorEmptyDocUri,
      new vscode.Position(5, 0),
      new vscode.CompletionList([
        fieldOutput,
        fieldPinnedPlatform,
        fieldPlatforms,
        fieldProvider,
      ])
    )
  })
})
