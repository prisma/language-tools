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
import { getBinPath, binaryIsNeeded, getDownloadURL } from '../prisma-fmt/util'
import install from '../prisma-fmt/install'

function assertCompletion(
  fixturePath: string,
  position: Position,
  expected: CompletionList,
): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params: CompletionParams = {
    textDocument: document,
    position: position,
    context: {
      triggerKind: 1,
    },
  }

  const completionResult: CompletionList | undefined = handleCompletionRequest(
    params,
    document,
    binPathPrismaFmt,
  )

  assert.ok(completionResult !== undefined)

  assert.deepStrictEqual(
    completionResult.isIncomplete,
    expected.isIncomplete,
    // eslint-disable-next-line  @typescript-eslint/restrict-template-expressions
    `Expected isIncomplete to be '${expected.isIncomplete}' but got '${completionResult.isIncomplete}'`,
  )

  assert.deepStrictEqual(
    completionResult.items.map((item) => item.label),
    expected.items.map((item) => item.label),
    'mapped items => item.label',
  )

  assert.deepStrictEqual(
    completionResult.items.length,
    expected.items.length,
    // eslint-disable-next-line  @typescript-eslint/restrict-template-expressions
    `Expected ${expected.items.length} suggestions and got ${
      completionResult.items.length
    }: ${JSON.stringify(completionResult.items, undefined, 2)}`, // TODO: This is missing the output of `expected.items` so one can compare
  )

  assert.deepStrictEqual(
    completionResult.items.length,
    expected.items.length,
    'items.length',
  )
}

// Cache prisma-fmt binary path
let binPathPrismaFmt = ''

suite('Completions', () => {
  suiteSetup(async () => {
    // install prisma-fmt binary
    if (binPathPrismaFmt === '') {
      binPathPrismaFmt = await getBinPath()
    }
    if (binaryIsNeeded(binPathPrismaFmt)) {
      await install(await getDownloadURL(), binPathPrismaFmt)
    }
  })

  const emptyDocUri = 'completions/empty.prisma'
  const sqliteDocUri = 'completions/datasourceWithSqlite.prisma'
  const dataSourceWithUri = 'completions/datasourceWithUrl.prisma'
  const emptyBlocksUri = 'completions/emptyBlocks.prisma'
  const modelBlocksUri = 'completions/modelBlocks.prisma'
  const enumCommentUri = 'completions/enumWithComments.prisma'
  const relationDirectiveUri = 'completions/relationDirective.prisma'

  // used both in generator and datasource
  const fieldProvider = {
    label: 'provider',
    kind: CompletionItemKind.Field,
  }

  suite('BASE BLOCKS', () => {
    test('Diagnoses block type suggestions with sqlite as provider', () => {
      assertCompletion(
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

    test('Diagnoses block type suggestions for empty file', () => {
      assertCompletion(
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
  })

  suite('DATABASE BLOCK', () => {
    const fieldUrl = { label: 'url', kind: CompletionItemKind.Field }
    const fieldShadowDatabaseUrl = {
      label: 'shadowDatabaseUrl',
      kind: CompletionItemKind.Field,
    }
    const sqlite = { label: 'sqlite', kind: CompletionItemKind.Constant }
    const mysql = { label: 'mysql', kind: CompletionItemKind.Constant }
    const postgresql = {
      label: 'postgresql',
      kind: CompletionItemKind.Constant,
    }
    const mssql = {
      label: 'sqlserver',
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

    test('Diagnoses datasource field suggestions in empty block', () => {
      assertCompletion(
        emptyBlocksUri,
        { line: 1, character: 0 },
        {
          isIncomplete: false,
          items: [fieldProvider, fieldUrl, fieldShadowDatabaseUrl],
        },
      )
    })

    test('Diagnoses datasource field suggestions with existing field', () => {
      assertCompletion(
        sqliteDocUri,
        { line: 2, character: 0 },
        {
          isIncomplete: false,
          items: [fieldUrl, fieldShadowDatabaseUrl],
        },
      )
      assertCompletion(
        dataSourceWithUri,
        { line: 2, character: 0 },
        {
          isIncomplete: false,
          items: [fieldProvider, fieldShadowDatabaseUrl],
        },
      )
    })

    test('Diagnoses url argument suggestions for datasource block', () => {
      assertCompletion(
        dataSourceWithUri,
        { line: 7, character: 10 },
        {
          isIncomplete: true,
          items: [quotationMarks, env],
        },
      ),
        assertCompletion(
          dataSourceWithUri,
          { line: 11, character: 15 },
          {
            isIncomplete: false,
            items: [envArgument],
          },
        )
    })

    test('Diagnoses single provider suggestions for datasource block', () => {
      assertCompletion(
        sqliteDocUri,
        { line: 14, character: 14 },
        {
          isIncomplete: true,
          items: [mysql, postgresql, sqlite, mssql],
        },
      ),
        assertCompletion(
          sqliteDocUri,
          { line: 18, character: 13 },
          {
            isIncomplete: true,
            items: [array, quotationMarks],
          },
        )
    })

    test('Diagnoses multiple provider suggestions for datasource block', () => {
      assertCompletion(
        sqliteDocUri,
        { line: 6, character: 15 },
        {
          isIncomplete: true,
          items: [mysql, postgresql, sqlite, mssql],
        },
      ),
        assertCompletion(
          sqliteDocUri,
          { line: 22, character: 14 },
          {
            isIncomplete: true,
            items: [quotationMarks],
          },
        )
      assertCompletion(
        sqliteDocUri,
        { line: 10, character: 25 },
        {
          isIncomplete: true,
          items: [mysql, postgresql, mssql],
        },
      )
    })
  })

  suite('GENERATOR BLOCK', () => {
    // fieldProvider defined above already
    const fieldOutput = { label: 'output', kind: CompletionItemKind.Field }
    const fieldBinaryTargets = {
      label: 'binaryTargets',
      kind: CompletionItemKind.Field,
    }
    const fieldPreviewFeatures = {
      label: 'previewFeatures',
      kind: CompletionItemKind.Field,
    }
    const fieldEngineType = {
      label: 'engineType',
      kind: CompletionItemKind.Field,
    }

    test('Diagnoses generator field suggestions in empty block', () => {
      assertCompletion(
        emptyBlocksUri,
        { line: 5, character: 0 },
        {
          isIncomplete: false,
          items: [
            fieldProvider,
            fieldOutput,
            fieldBinaryTargets,
            fieldPreviewFeatures,
            fieldEngineType,
          ],
        },
      )
    })

    const generatorWithExistingFieldsUri =
      'completions/generatorWithExistingFields.prisma'

    test('Diagnoses generator field suggestions with existing fields', () => {
      assertCompletion(
        generatorWithExistingFieldsUri,
        { line: 2, character: 0 },
        {
          isIncomplete: false,
          items: [
            fieldOutput,
            fieldBinaryTargets,
            fieldPreviewFeatures,
            fieldEngineType,
          ],
        },
      )
      assertCompletion(
        generatorWithExistingFieldsUri,
        { line: 7, character: 0 },
        {
          isIncomplete: false,
          items: [
            fieldProvider,
            fieldBinaryTargets,
            fieldPreviewFeatures,
            fieldEngineType,
          ],
        },
      )
    })

    // TODO provider autocompletion
    // TODO previewFeatures autocompletion

    test('Diagnoses engineType value suggestions', () => {
      assertCompletion(
        generatorWithExistingFieldsUri,
        { line: 11, character: 17 },
        {
          isIncomplete: true,
          items: [
            {
              label: '""',
              kind: CompletionItemKind.Property,
            },
          ],
        },
      )
      assertCompletion(
        generatorWithExistingFieldsUri,
        { line: 15, character: 18 },
        {
          isIncomplete: true,
          items: [
            {
              label: 'library',
              kind: CompletionItemKind.Value,
            },
            {
              label: 'binary',
              kind: CompletionItemKind.Value,
            },
          ],
        },
      )
    })
  })

  suite('BLOCK ATTRIBUTES', () => {
    const blockAttributeId = {
      label: '@@id([])',
      kind: CompletionItemKind.Property,
    }
    const blockAttributeMap = {
      label: '@@map("")',
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
    const blockAttributeIgnore = {
      label: '@@ignore',
      kind: CompletionItemKind.Property,
    }

    test('Diagnoses block attribute suggestions first in a line', () => {
      assertCompletion(
        emptyBlocksUri,
        { line: 9, character: 0 },
        {
          isIncomplete: false,
          items: [
            blockAttributeMap,
            blockAttributeId,
            blockAttributeUnique,
            blockAttributeIndex,
            blockAttributeIgnore,
          ],
        },
      )
    })

    test('Diagnoses block attribute suggestions with existing attributes first in a line', () => {
      assertCompletion(
        modelBlocksUri,
        { line: 5, character: 0 },
        {
          isIncomplete: false,
          items: [
            blockAttributeMap,
            blockAttributeId,
            blockAttributeUnique,
            blockAttributeIndex,
            blockAttributeIgnore,
          ],
        },
      )
      assertCompletion(
        modelBlocksUri,
        { line: 14, character: 0 },
        {
          isIncomplete: false,
          items: [
            blockAttributeMap,
            blockAttributeUnique,
            blockAttributeIndex,
            blockAttributeIgnore,
          ],
        },
      )
    })
  })

  suite('TYPES', () => {
    test('Diagnoses type suggestions in model block', () => {
      assertCompletion(
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
            { label: 'Bytes', kind: CompletionItemKind.TypeParameter },
            { label: 'Decimal', kind: CompletionItemKind.TypeParameter },
            { label: 'BigInt', kind: CompletionItemKind.TypeParameter },
            {
              label: 'Unsupported("")',
              kind: CompletionItemKind.TypeParameter,
            },
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
            { label: 'ForthUser', kind: CompletionItemKind.Reference },
          ],
        },
      )
    })
  })

  suite('FIELD ATTRIBUTES', () => {
    const fieldAttributeId = {
      label: '@id',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeUnique = {
      label: '@unique',
      kind: CompletionItemKind.Property,
    }
    const fieldAttributeMap = {
      label: '@map("")',
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
    const fieldAttributeIgnore = {
      label: '@ignore',
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
    const functionDbGenerated = {
      label: 'dbgenerated("")',
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
    const onDeleteProperty = {
      label: 'onDelete: ',
      kind: CompletionItemKind.Property,
    }
    const onUpdateProperty = {
      label: 'onUpdate: ',
      kind: CompletionItemKind.Property,
    }
    const nameQuotesProperty = {
      label: '""',
      kind: CompletionItemKind.Property,
    }
    const nameProperty = {
      label: 'name: ',
      kind: CompletionItemKind.Property,
    }

    test('Diagnoses field and block attribute suggestions', () => {
      assertCompletion(
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
            fieldAttributeIgnore,
          ],
        },
      )
      assertCompletion(
        modelBlocksUri,
        { line: 19, character: 14 },
        {
          isIncomplete: false,
          items: [
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      )
      assertCompletion(
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
            fieldAttributeIgnore,
          ],
        },
      )
      assertCompletion(
        modelBlocksUri,
        { line: 13, character: 16 },
        {
          isIncomplete: false,
          items: [
            fieldAttributeUnique,
            fieldAttributeMap,
            fieldAttributeDefault,
            fieldAttributeRelation,
            fieldAttributeIgnore,
          ],
        },
      )

      assertCompletion(
        modelBlocksUri,
        { line: 74, character: 24 },
        {
          isIncomplete: false,
          items: [{ label: 'lastName', kind: CompletionItemKind.Field }],
        },
      )
    })

    test('Diagnoses functions as default values', () => {
      assertCompletion(
        modelBlocksUri,
        { line: 11, character: 24 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, functionAutoInc],
        },
      )
      assertCompletion(
        modelBlocksUri,
        { line: 28, character: 27 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, functionUuid, functionCuid],
        },
      )
      assertCompletion(
        modelBlocksUri,
        { line: 30, character: 36 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, functionNow],
        },
      )
    })

    test('Diagnoses static default values', () => {
      assertCompletion(
        modelBlocksUri,
        { line: 24, character: 28 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, staticValueTrue, staticValueFalse],
        },
      )
    })

    test('Diagnoses default suggestions for enum values', () => {
      assertCompletion(
        modelBlocksUri,
        { line: 62, character: 27 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, enumValueOne, enumValueTwo],
        },
      )
    })

    test('Diagnoses default suggestions for enum values excluding comments', () => {
      assertCompletion(
        enumCommentUri,
        { line: 11, character: 30 },
        {
          isIncomplete: false,
          items: [functionDbGenerated, enumValueOne, enumValueTwo],
        },
      )
    })

    test('Diagnoses arguments of @@unique', () => {
      assertCompletion(
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

    test('Diagnoses arguments of @@id', () => {
      assertCompletion(
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

    test('Diagnoses arguments of @@index', () => {
      assertCompletion(
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

    suite('Diagnoses arguments of @relation directive', function () {
      test('@relation(|)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 12, character: 26 },
          {
            isIncomplete: false,
            items: [
              referencesProperty,
              fieldsProperty,
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
            ],
          },
        )
      })
      test('@relation(references: [|])', () => {
        assertCompletion(
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
      })
      test('@relation(references: [id], |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 30, character: 44 },
          {
            isIncomplete: false,
            items: [
              fieldsProperty,
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
            ],
          },
        )
      })
      test('order Order @relation(fields: [orderId], |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 39, character: 45 },
          {
            isIncomplete: false,
            items: [
              referencesProperty,
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
            ],
          },
        )
      })
      test('@relation(fields: [|])', () => {
        assertCompletion(
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
      test('@relation(fields: [orderId], references: [id], |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 57, character: 62 },
          {
            isIncomplete: false,
            items: [
              onDeleteProperty,
              onUpdateProperty,
              nameQuotesProperty,
              nameProperty,
            ],
          },
        )
      })
      test('@relation(onDelete: |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 66, character: 36 },
          {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        )
      })
      test('@relation(onUpdate: |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 75, character: 36 },
          {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        )
      })
      test('@relation(fields: [orderId], references: [id], onDelete: |)', () => {
        assertCompletion(
          relationDirectiveUri,
          { line: 84, character: 73 },
          {
            isIncomplete: false,
            items: [
              { label: 'Cascade', kind: CompletionItemKind.Enum },
              { label: 'Restrict', kind: CompletionItemKind.Enum },
              { label: 'NoAction', kind: CompletionItemKind.Enum },
              { label: 'SetNull', kind: CompletionItemKind.Enum },
              { label: 'SetDefault', kind: CompletionItemKind.Enum },
            ],
          },
        )
      })
    })
  })
})
