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
  assert.deepStrictEqual(actualCompletions.items.map(item => item.documentation), expectedCompletionList.items.map(item => item.documentation))
  assert.deepStrictEqual(actualCompletions.items.map(item => item.detail), expectedCompletionList.items.map(item => item.detail))
}

suite('Should auto-complete', () => {
  const emptyDocUri = getDocUri('completions/empty.prisma')

  // ALL BLOCKS

  test('Diagnoses block type suggestions for empty file', async () => {
    await testCompletion(
      emptyDocUri,
      new vscode.Position(0, 0),
      new vscode.CompletionList([
        { label: 'datasource', kind: vscode.CompletionItemKind.Class, documentation: 'The datasource block tells the schema where the models are backed.' },
        { label: 'enum', kind: vscode.CompletionItemKind.Class, documentation: 'Enums are defined via the enum block. You can define enums in your data model if they\'re supported by the data source you use:\nâ€¢ PostgreSQL: Supported\nâ€¢ MySQL: Supported\nâ€¢ MariaDB: Supported\nâ€¢ SQLite: Not supported' },
        { label: 'generator', kind: vscode.CompletionItemKind.Class, documentation: 'Generator blocks configure which clients are generated and how they\'re generated. Language preferences and binary configuration will go in here.' },
        { label: 'model', kind: vscode.CompletionItemKind.Class, documentation: 'Models represent the entities of your application domain. They are defined using model blocks in the data model.' },
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
        { label: 'datasource', kind: vscode.CompletionItemKind.Class, documentation: 'The datasource block tells the schema where the models are backed.' },
        { label: 'generator', kind: vscode.CompletionItemKind.Class, documentation: 'Generator blocks configure which clients are generated and how they\'re generated. Language preferences and binary configuration will go in here.' },
        { label: 'model', kind: vscode.CompletionItemKind.Class, documentation: 'Models represent the entities of your application domain. They are defined using model blocks in the data model.' },
        { label: 'type_alias', kind: vscode.CompletionItemKind.Class },
      ], false)
    )
  })

  // DATASOURCE BLOCK
/*
  const dataSourceFieldProvider = { label: 'provider', kind: vscode.CompletionItemKind.Field, documentation: 'Can be one of the following built in datasource providers:\n•`postgresql`\n•`mysql`\n•`sqlite`' }
  const dataSourceFieldUrl = { label: 'url', kind: vscode.CompletionItemKind.Field, documentation: 'Connection URL including authentication info. Each datasource provider documents the URL syntax. Most providers use the syntax provided by the database. (more information see https://github.com/prisma/specs/blob/master/schema/datasource_urls.md)' }
  const dataSourceEmptyDocUri = getDocUri('completions/datasourceEmpty.prisma')
  test('Diagnoses datasource field suggestions in empty block', async () => {
    await testCompletion(
      dataSourceEmptyDocUri,
      new vscode.Position(1, 0),
      new vscode.CompletionList([
        dataSourceFieldProvider,
        dataSourceFieldUrl
      ])
    )
  })

  test('Diagnoses datasource field suggestions with existing provider', async () => {
    await testCompletion(
      sqliteDocUri,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        dataSourceFieldUrl
      ])
    )
  })

  const dataSourceWithUrl = getDocUri('completions/datasourceWithUrl.prisma')
  test('Diagnoses datasource field suggestions with existing url', async () => {
    await testCompletion(
      dataSourceWithUrl,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        dataSourceFieldProvider
      ])
    )
  })*/

  // ... BLOCK
})
