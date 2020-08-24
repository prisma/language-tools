import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleCompletionRequest } from '../MessageHandler'
import {
  CompletionList,
  CompletionParams,
  Position,
  CompletionItemKind,
} from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'
import { getBinPath, binaryIsNeeded } from '../util'
import install from '../install'

async function assertCompletion(
  fixturePath: string,
  position: Position,
  expected: CompletionList,
): Promise<void> {
  const document: TextDocument = getTextDocument(fixturePath)

  const params: CompletionParams = {
    textDocument: document,
    position: position,
    context: {
      triggerKind: 1,
    },
  }

  const completionResult:
    | CompletionList
    | undefined = await handleCompletionRequest(params, document)

  assert.ok(completionResult !== undefined)
  assert.deepStrictEqual(completionResult.isIncomplete, expected.isIncomplete)
  assert.deepStrictEqual(completionResult.items.length, expected.items.length)
  assert.deepStrictEqual(
    completionResult.items.map((items) => items.label),
    expected.items.map((items) => items.label),
  )
  assert.deepStrictEqual(
    completionResult.items.map((item) => item.kind),
    expected.items.map((item) => item.kind),
  )
}

suite('Quick Fix', () => {
  suiteSetup(async () => {
    // install prisma-fmt binary
    const binPathPrismaFmt = await getBinPath()
    if (await binaryIsNeeded(binPathPrismaFmt)) await install(binPathPrismaFmt)
  })

  const emptyDocUri = 'completions/empty.prisma'
  const sqliteDocUri = 'completions/datasourceWithSqlite.prisma'
  const dataSourceWithUri = 'completions/datasourceWithUrl.prisma'
  const emptyBlocksUri = 'completions/emptyBlocks.prisma'
  const modelBlocksUri = 'completions/modelBlocks.prisma'

  // ALL BLOCKS

  test('Diagnoses block type suggestions with sqlite as provider', async () => {
    await assertCompletion(
      sqliteDocUri,
      { line: 4, character: 0 },
      {
        isIncomplete: false,
        items: [
          { label: 'datasource', kind: CompletionItemKind.Class },
          { label: 'generator', kind: CompletionItemKind.Class },
          { label: 'model', kind: CompletionItemKind.Class },
        ],
      },
    )
  })

  test('Diagnoses block type suggestions for empty file', async () => {
    await assertCompletion(
      emptyDocUri,
      { line: 0, character: 0 },
      {
        isIncomplete: false,
        items: [
          { label: 'datasource', kind: CompletionItemKind.Class },
          { label: 'generator', kind: CompletionItemKind.Class },
          { label: 'model', kind: CompletionItemKind.Class },
          { label: 'enum', kind: CompletionItemKind.Class },
        ],
      },
    )
  })

  // DATASOURCE BLOCK

  const fieldProvider = {
    label: 'provider',
    kind: CompletionItemKind.Field,
  }
  const fieldUrl = { label: 'url', kind: CompletionItemKind.Field }
  const sqlite = { label: 'sqlite', kind: CompletionItemKind.Constant }
  const mysql = { label: 'mysql', kind: CompletionItemKind.Constant }
  const postgresql = {
    label: 'postgresql',
    kind: CompletionItemKind.Constant,
  }
  const array = { label: '[]', kind: CompletionItemKind.Property }
  const quotationMarks = {
    label: '""',
    kind: CompletionItemKind.Property,
  }
  const envArgument = {
    label: 'DATABASE_URL',
    kind: CompletionItemKind.Constant,
  }
  const env = { label: 'env()', kind: CompletionItemKind.Property }

  test('Diagnoses datasource field suggestions in empty block', async () => {
    await assertCompletion(
      emptyBlocksUri,
      { line: 1, character: 0 },
      {
        isIncomplete: false,
        items: [fieldProvider, fieldUrl],
      },
    )
  })

  test('Diagnoses datasource field suggestions with existing field', async () => {
    await assertCompletion(
      sqliteDocUri,
      { line: 2, character: 0 },
      {
        isIncomplete: false,
        items: [fieldUrl],
      },
    )
    await assertCompletion(
      dataSourceWithUri,
      { line: 2, character: 0 },
      {
        isIncomplete: false,
        items: [fieldProvider],
      },
    )
  })

  test('Diagnoses url argument suggestions for datasource block', async () => {
    await assertCompletion(
      dataSourceWithUri,
      { line: 7, character: 10 },
      {
        isIncomplete: true,
        items: [quotationMarks, env],
      },
    ),
      await assertCompletion(
        dataSourceWithUri,
        { line: 11, character: 15 },
        {
          isIncomplete: false,
          items: [envArgument],
        },
      )
  })

  test('Diagnoses single provider suggestions for datasource block', async () => {
    await assertCompletion(
      sqliteDocUri,
      { line: 14, character: 14 },
      {
        isIncomplete: true,
        items: [mysql, postgresql, sqlite],
      },
    ),
      await assertCompletion(
        sqliteDocUri,
        { line: 18, character: 13 },
        {
          isIncomplete: true,
          items: [array, quotationMarks],
        },
      )
  })

  test('Diagnoses multiple provider suggestions for datasource block', async () => {
    await assertCompletion(
      sqliteDocUri,
      { line: 6, character: 15 },
      {
        isIncomplete: true,
        items: [mysql, postgresql, sqlite],
      },
    ),
      await assertCompletion(
        sqliteDocUri,
        { line: 22, character: 14 },
        {
          isIncomplete: true,
          items: [quotationMarks],
        },
      )
    await assertCompletion(
      sqliteDocUri,
      { line: 10, character: 25 },
      {
        isIncomplete: true,
        items: [mysql, postgresql],
      },
    )
  })

  // GENERATOR BLOCK

  const fieldOutput = { label: 'output', kind: CompletionItemKind.Field }
  const fieldBinaryTargets = {
    label: 'binaryTargets',
    kind: CompletionItemKind.Field,
  }
  const fieldPreviewFeatures = {
    label: 'previewFeatures',
    kind: CompletionItemKind.Field,
  }

  const generatorWithExistingFieldsUri =
    'completions/generatorWithExistingFields.prisma'

  test('Diagnoses generator field suggestions in empty block', async () => {
    await assertCompletion(
      emptyBlocksUri,
      { line: 5, character: 0 },
      {
        isIncomplete: false,
        items: [
          fieldProvider,
          fieldOutput,
          fieldBinaryTargets,
          fieldPreviewFeatures,
        ],
      },
    )
  })

  test('Diagnoses generator field suggestions with existing fields', async () => {
    await assertCompletion(
      generatorWithExistingFieldsUri,
      { line: 2, character: 0 },
      {
        isIncomplete: false,
        items: [fieldOutput, fieldBinaryTargets, fieldPreviewFeatures],
      },
    )
    await assertCompletion(
      generatorWithExistingFieldsUri,
      { line: 7, character: 0 },
      {
        isIncomplete: false,
        items: [fieldProvider, fieldBinaryTargets, fieldPreviewFeatures],
      },
    )
  })

  // BLOCK ATTRIBUTES

  const blockAttributeId = {
    label: '@@id([])',
    kind: CompletionItemKind.Property,
  }
  const blockAttributeMap = {
    label: '@@map([])',
    kind: CompletionItemKind.Property,
  }
  const blockAttributeUnique = {
    label: '@@unique([])',
    kind: CompletionItemKind.Property,
  }
  const blockAttributeIndex = {
    label: '@@index([])',
    kind: CompletionItemKind.Property,
  }

  test('Diagnoses block attribute suggestions first in a line', async () => {
    await assertCompletion(
      emptyBlocksUri,
      { line: 9, character: 0 },
      {
        isIncomplete: false,
        items: [
          blockAttributeMap,
          blockAttributeId,
          blockAttributeUnique,
          blockAttributeIndex,
        ],
      },
    )
  })

  test('Diagnoses block attribute suggestions with existing attributes first in a line', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 5, character: 0 },
      {
        isIncomplete: false,
        items: [
          blockAttributeMap,
          blockAttributeId,
          blockAttributeUnique,
          blockAttributeIndex,
        ],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 14, character: 0 },
      {
        isIncomplete: false,
        items: [blockAttributeMap, blockAttributeUnique, blockAttributeIndex],
      },
    )
  })

  // TYPES

  test('Diagnoses type suggestions in model block', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 51, character: 7 },
      {
        isIncomplete: true,
        items: [
          { label: 'String', kind: CompletionItemKind.TypeParameter },
          { label: 'Boolean', kind: CompletionItemKind.TypeParameter },
          { label: 'Int', kind: CompletionItemKind.TypeParameter },
          { label: 'Float', kind: CompletionItemKind.TypeParameter },
          { label: 'DateTime', kind: CompletionItemKind.TypeParameter },
          { label: 'Json', kind: CompletionItemKind.TypeParameter },
          { label: 'User', kind: CompletionItemKind.Reference },
          { label: 'Post', kind: CompletionItemKind.Reference },
          { label: 'Person', kind: CompletionItemKind.Reference },
          { label: 'Test', kind: CompletionItemKind.Reference },
          { label: 'Cat', kind: CompletionItemKind.Reference },
          { label: 'SecondUser', kind: CompletionItemKind.Reference },
          { label: 'ThirdUser', kind: CompletionItemKind.Reference },
          { label: 'TypeCheck', kind: CompletionItemKind.Reference },
          { label: 'Hello', kind: CompletionItemKind.Reference },
          { label: 'DateTest', kind: CompletionItemKind.Reference },
          { label: 'UserType', kind: CompletionItemKind.Reference },
        ],
      },
    )
  })

  // FIELD ATTRIBUTES

  const fieldAttributeId = {
    label: '@id',
    kind: CompletionItemKind.Property,
  }
  const fieldAttributeUnique = {
    label: '@unique',
    kind: CompletionItemKind.Property,
  }
  const fieldAttributeMap = {
    label: '@map()',
    kind: CompletionItemKind.Property,
  }
  const fieldAttributeDefault = {
    label: '@default()',
    kind: CompletionItemKind.Property,
  }
  const fieldAttributeRelation = {
    label: '@relation()',
    kind: CompletionItemKind.Property,
  }
  const fieldAttributeUpdatedAt = {
    label: '@updatedAt',
    kind: CompletionItemKind.Property,
  }

  const functionCuid = {
    label: 'cuid()',
    kind: CompletionItemKind.Function,
  }
  const functionUuid = {
    label: 'uuid()',
    kind: CompletionItemKind.Function,
  }
  const functionAutoInc = {
    label: 'autoincrement()',
    kind: CompletionItemKind.Function,
  }
  const functionNow = {
    label: 'now()',
    kind: CompletionItemKind.Function,
  }
  const staticValueTrue = {
    label: 'true',
    kind: CompletionItemKind.Value,
  }
  const staticValueFalse = {
    label: 'false',
    kind: CompletionItemKind.Value,
  }
  const enumValueOne = {
    label: 'ADMIN',
    kind: CompletionItemKind.Value,
  }
  const enumValueTwo = {
    label: 'NORMAL',
    kind: CompletionItemKind.Value,
  }

  const fieldsProperty = {
    label: 'fields: []',
    kind: CompletionItemKind.Property,
  }
  const referencesProperty = {
    label: 'references: []',
    kind: CompletionItemKind.Property,
  }

  const nameProperty = {
    label: '""',
    kind: CompletionItemKind.Property,
  }

  test('Diagnoses field and block attribute suggestions', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 18, character: 14 },
      {
        isIncomplete: false,
        items: [
          fieldAttributeId,
          fieldAttributeUnique,
          fieldAttributeMap,
          fieldAttributeDefault,
          fieldAttributeRelation,
        ],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 19, character: 14 },
      {
        isIncomplete: false,
        items: [
          fieldAttributeUnique,
          fieldAttributeMap,
          fieldAttributeDefault,
          fieldAttributeRelation,
        ],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 61, character: 20 },
      {
        isIncomplete: false,
        items: [
          fieldAttributeUnique,
          fieldAttributeMap,
          fieldAttributeDefault,
          fieldAttributeRelation,
          fieldAttributeUpdatedAt,
        ],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 13, character: 16 },
      {
        isIncomplete: false,
        items: [
          fieldAttributeUnique,
          fieldAttributeMap,
          fieldAttributeDefault,
          fieldAttributeRelation,
        ],
      },
    )
  })

  test('Diagnoses functions as default values', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 11, character: 24 },
      {
        isIncomplete: false,
        items: [functionAutoInc],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 28, character: 27 },
      {
        isIncomplete: false,
        items: [functionUuid, functionCuid],
      },
    )
    await assertCompletion(
      modelBlocksUri,
      { line: 30, character: 36 },
      {
        isIncomplete: false,
        items: [functionNow],
      },
    )
  })

  test('Diagnoses static default values', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 24, character: 28 },
      {
        isIncomplete: false,
        items: [staticValueTrue, staticValueFalse],
      },
    )
  })

  test('Diagnoses default suggestions for enum values', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 62, character: 27 },
      {
        isIncomplete: false,
        items: [enumValueOne, enumValueTwo],
      },
    )
  })

  test('Diagnoses arguments of @@unique', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 38, character: 15 },
      {
        isIncomplete: false,
        items: [
          { label: 'firstName', kind: CompletionItemKind.Field },
          { label: 'lastName', kind: CompletionItemKind.Field },
          { label: 'isAdmin', kind: CompletionItemKind.Field },
        ],
      },
    )
  })

  test('Diagnoses arguments of @@id', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 46, character: 10 },
      {
        isIncomplete: false,
        items: [
          { label: 'firstName', kind: CompletionItemKind.Field },
          { label: 'lastName', kind: CompletionItemKind.Field },
          { label: 'isAdmin', kind: CompletionItemKind.Field },
        ],
      },
    )
  })

  test('Diagnoses arguments of @@index', async () => {
    await assertCompletion(
      modelBlocksUri,
      { line: 47, character: 13 },
      {
        isIncomplete: false,
        items: [
          { label: 'firstName', kind: CompletionItemKind.Field },
          { label: 'lastName', kind: CompletionItemKind.Field },
          { label: 'isAdmin', kind: CompletionItemKind.Field },
        ],
      },
    )
  })

  const relationDirectiveUri = 'completions/relationDirective.prisma'
  test('Diagnoses arguments of @relation directive', async () => {
    await assertCompletion(
      relationDirectiveUri,
      { line: 12, character: 26 },
      {
        isIncomplete: false,
        items: [referencesProperty, fieldsProperty, nameProperty],
      },
    )
    await assertCompletion(
      relationDirectiveUri,
      { line: 21, character: 39 },
      {
        isIncomplete: false,
        items: [
          { label: 'id', kind: CompletionItemKind.Field },
          { label: 'items', kind: CompletionItemKind.Field },
          { label: 'total', kind: CompletionItemKind.Field },
        ],
      },
    )
    await assertCompletion(
      relationDirectiveUri,
      { line: 30, character: 44 },
      {
        isIncomplete: false,
        items: [fieldsProperty, nameProperty],
      },
    )
    await assertCompletion(
      relationDirectiveUri,
      { line: 39, character: 45 },
      {
        isIncomplete: false,
        items: [referencesProperty, nameProperty],
      },
    )
    await assertCompletion(
      relationDirectiveUri,
      { line: 48, character: 35 },
      {
        isIncomplete: false,
        items: [
          { label: 'id', kind: CompletionItemKind.Field },
          { label: 'productName', kind: CompletionItemKind.Field },
          { label: 'productPrice', kind: CompletionItemKind.Field },
          { label: 'quantity', kind: CompletionItemKind.Field },
          { label: 'orderId', kind: CompletionItemKind.Field },
        ],
      },
    )
  })
})
