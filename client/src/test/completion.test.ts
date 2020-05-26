import vscode, { CompletionList } from 'vscode'
import assert from 'assert'
import { getDocUri, activate, toRange } from './helper'

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
  assert.deepStrictEqual(actualCompletions.items.map(item => item.documentation), expectedCompletionList.items.map(item => item.documentation))
  assert.deepStrictEqual(actualCompletions.items.map(item => item.detail), expectedCompletionList.items.map(item => item.detail))
}

suite('Should auto-complete', () => {
  const docUri = getDocUri('completions/empty.prisma')

  test('Diagnoses block type suggestions', async () => {
    await testCompletion(
      docUri,
      new vscode.Position(0, 0),
      new vscode.CompletionList([
        {label: 'datasource', kind: vscode.CompletionItemKind.Class, documentation: 'The datasource block tells the schema where the models are backed.'},
        {label: 'enum', kind: vscode.CompletionItemKind.Class, documentation: 'Enums are defined via the enum block. You can define enums in your data model if they\'re supported by the data source you use:\n• PostgreSQL: Supported\n• MySQL: Supported\n• MariaDB: Supported\n• SQLite: Not supported'},
        {label: 'generator', kind: vscode.CompletionItemKind.Class, documentation: 'Generator blocks configure which clients are generated and how they\'re generated. Language preferences and binary configuration will go in here.'},
        {label: 'model', kind: vscode.CompletionItemKind.Class, documentation: 'Models represent the entities of your application domain. They are defined using model blocks in the data model.'},
        {label: 'type_alias', kind: vscode.CompletionItemKind.Class},
      ], false)
    )
  })
})
