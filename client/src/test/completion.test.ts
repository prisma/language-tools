import vscode, { CompletionList } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from './helper'

async function testCompletion(
  docUri: vscode.Uri,
  position: vscode.Position,
  expectedCompletionList: CompletionList,
  isActivated: boolean,
  triggerCharacter?: string,
): Promise<void> {
  if (!isActivated) {
    await activate(docUri)
  }

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

  // Uri's

  const emptyDocUri = getDocUri('completions/empty.prisma')
  const sqliteDocUri = getDocUri('completions/datasourceWithSqlite.prisma')
  const dataSourceWithUri = getDocUri('completions/datasourceWithUrl.prisma')
  const emptyBlocksUri = getDocUri('completions/emptyBlocks.prisma')
  const modelBlocksUri = getDocUri('completions/modelBlocks.prisma')


  // ALL BLOCKS

  test('Diagnoses block type suggestions with sqlite as provider', async () => {
    await testCompletion(
      sqliteDocUri,
      new vscode.Position(4, 0),
      new vscode.CompletionList([
        { label: 'datasource', kind: vscode.CompletionItemKind.Class },
        { label: 'generator', kind: vscode.CompletionItemKind.Class },
        { label: 'model', kind: vscode.CompletionItemKind.Class },
        { label: 'type_alias', kind: vscode.CompletionItemKind.Class },
      ], false),
      false
    )
  })

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
      ], false),
      false
    )
  })


  // DATASOURCE BLOCK

  const fieldProvider = { label: 'provider', kind: vscode.CompletionItemKind.Field }
  const fieldUrl = { label: 'url', kind: vscode.CompletionItemKind.Field }

  test('Diagnoses datasource field suggestions in empty block', async () => {
    await testCompletion(
      emptyBlocksUri,
      new vscode.Position(1, 0),
      new vscode.CompletionList([
        fieldProvider,
        fieldUrl
      ]),
      false
    )
  })

  test('Diagnoses datasource field suggestions with existing field', async () => {
    await testCompletion(
      sqliteDocUri,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        fieldUrl
      ]),
      false
    )
    await testCompletion(
      dataSourceWithUri,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        fieldProvider
      ]),
      false
    )
  })

  // GENERATOR BLOCK

  const fieldOutput = { label: 'output', kind: vscode.CompletionItemKind.Field }

  const generatorWithExistingFieldsUri = getDocUri('completions/generatorWithExistingFields.prisma')
  test('Diagnoses generator field suggestions in empty block', async () => {
    await testCompletion(
      emptyBlocksUri,
      new vscode.Position(5, 0),
      new vscode.CompletionList([
        fieldOutput,
        fieldProvider,
      ]), false
    )
  })

  test('Diagnoses generator field suggestions with existing fields', async () => {
    await activate(generatorWithExistingFieldsUri)
    await testCompletion(
      generatorWithExistingFieldsUri,
      new vscode.Position(2, 0),
      new vscode.CompletionList([
        fieldOutput
      ]), true
    )
    await testCompletion(
      generatorWithExistingFieldsUri,
      new vscode.Position(7, 0),
      new vscode.CompletionList([
        fieldProvider
      ]), true
    )
  })

  // BLOCK ATTRIBUTES

  const blockAttributeId = { label: '@@id([])', kind: vscode.CompletionItemKind.Property }
  const blockAttributeMap = { label: '@@map([])', kind: vscode.CompletionItemKind.Property }
  const blockAttributeUnique = { label: '@@unique([])', kind: vscode.CompletionItemKind.Property }
  const blockAttributeIndex = { label: '@@index([])', kind: vscode.CompletionItemKind.Property }


  test('Diagnoses block attribute suggestions first in a line', async () => {
    await testCompletion(
      emptyBlocksUri,
      new vscode.Position(9, 0),
      new vscode.CompletionList([
        blockAttributeId,
        blockAttributeIndex,
        blockAttributeMap,
        blockAttributeUnique,
      ]), false
    )
  })

  test('Diagnoses block attribute suggestions with existing attributes first in a line', async () => {
    await activate(modelBlocksUri)
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(5, 0),
      new vscode.CompletionList([
        blockAttributeId,
        blockAttributeIndex,
        blockAttributeMap,
      ]), true
    )
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(14, 0),
      new vscode.CompletionList([
        blockAttributeIndex,
        blockAttributeMap,
      ]), true
    )
  })

  // FIELD ATTRIBUTES

  const fieldAttributeId = { label: '@id', kind: vscode.CompletionItemKind.Property }
  const fieldAttributeUnique = { label: '@unique', kind: vscode.CompletionItemKind.Property }
  const fieldAttributeMap = { label: '@map()', kind: vscode.CompletionItemKind.Property }
  const fieldAttributeDefault = { label: '@default()', kind: vscode.CompletionItemKind.Property }
  const fieldAttributeRelation = { label: '@relation()', kind: vscode.CompletionItemKind.Property }

  const functionCuid = { label: 'cuid()', kind: vscode.CompletionItemKind.Function }
  const functionUuid = { label: 'uuid()', kind: vscode.CompletionItemKind.Function }
  const functionAutoInc = { label: 'autoincrement()', kind: vscode.CompletionItemKind.Function }
  const functionNow = { label: 'now()', kind: vscode.CompletionItemKind.Function }
  const staticValueTrue = { label: 'true', kind: vscode.CompletionItemKind.Value }
  const staticValueFalse = { label: 'false', kind: vscode.CompletionItemKind.Value }

  const fieldsProperty = { label: 'fields: []', kind: vscode.CompletionItemKind.Property }
  const referencesProperty = { label: 'references: []', kind: vscode.CompletionItemKind.Property }

  test('Diagnoses field and block attribute suggestions', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(18, 14),
      new vscode.CompletionList([
        fieldAttributeDefault,
        fieldAttributeId,
        fieldAttributeMap,
        fieldAttributeRelation,
        fieldAttributeUnique
      ]), true
    )
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(19, 14),
      new vscode.CompletionList([
        fieldAttributeDefault,
        fieldAttributeMap,
        fieldAttributeRelation,
        fieldAttributeUnique
      ]), true
    )
  })

  test('Diagnoses functions as default values', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(11, 24),
      new vscode.CompletionList([
        functionAutoInc,
      ]), true
    )
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(28, 27),
      new vscode.CompletionList([
        functionCuid,
        functionUuid
      ]), true
    )
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(30, 36),
      new vscode.CompletionList([
        functionNow
      ]), true
    )
  })

  test('Diagnoses static default values', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(24, 28),
      new vscode.CompletionList([
        staticValueFalse,
        staticValueTrue
      ]), true
    )
  })

  test('Diagnoses arguments of @@unique', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(38, 15),
      new vscode.CompletionList([
        { label: 'firstName', kind: vscode.CompletionItemKind.Field },
        { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
        { label: 'lastName', kind: vscode.CompletionItemKind.Field }
      ]), true
    )
  })

  test('Diagnoses arguments of @@id', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(46, 10),
      new vscode.CompletionList([
        { label: 'firstName', kind: vscode.CompletionItemKind.Field },
        { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
        { label: 'lastName', kind: vscode.CompletionItemKind.Field }
      ]), true
    )
  })

  test('Diagnoses arguments of @@index', async () => {
    await testCompletion(
      modelBlocksUri,
      new vscode.Position(47, 13),
      new vscode.CompletionList([
        { label: 'firstName', kind: vscode.CompletionItemKind.Field },
        { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
        { label: 'lastName', kind: vscode.CompletionItemKind.Field }
      ]), true
    )
  })

  const relationDirectiveUri = getDocUri('completions/relationDirective.prisma')
  test('Diagnoses arguments of @relation directive', async () => {
    await activate(relationDirectiveUri)
    await testCompletion(
      relationDirectiveUri,
      new vscode.Position(12, 26),
      new vscode.CompletionList([
        { label: '""', kind: vscode.CompletionItemKind.Property },
        fieldsProperty,
        referencesProperty
      ]), true
    )
    await testCompletion(
      relationDirectiveUri,
      new vscode.Position(21, 39),
      new vscode.CompletionList([
        { label: 'id', kind: vscode.CompletionItemKind.Field },
        { label: 'items', kind: vscode.CompletionItemKind.Field },
        { label: 'total', kind: vscode.CompletionItemKind.Field }
      ]), true
    )
    await testCompletion(
      relationDirectiveUri,
      new vscode.Position(30, 44),
      new vscode.CompletionList([
        fieldsProperty
      ]), true
    )
    await testCompletion(
      relationDirectiveUri,
      new vscode.Position(39, 45),
      new vscode.CompletionList([
        referencesProperty
      ]), true
    )
    await testCompletion(
      relationDirectiveUri,
      new vscode.Position(48, 35),
      new vscode.CompletionList([
        { label: 'id', kind: vscode.CompletionItemKind.Field },
        { label: 'orderId', kind: vscode.CompletionItemKind.Field },
        { label: 'productName', kind: vscode.CompletionItemKind.Field },
        { label: 'productPrice', kind: vscode.CompletionItemKind.Field },
        { label: 'quantity', kind: vscode.CompletionItemKind.Field }
      ]), true
    )
  })


  // TODO test with triggerCharacters !!!

})
