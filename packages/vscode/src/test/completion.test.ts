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

  const actualCompletions: vscode.CompletionList =
    (await vscode.commands.executeCommand(
      'vscode.executeCompletionItemProvider',
      docUri,
      position,
      triggerCharacter,
    )) as vscode.CompletionList

  assert.deepStrictEqual(
    actualCompletions.isIncomplete,
    expectedCompletionList.isIncomplete,
    /* eslint-disable @typescript-eslint/restrict-template-expressions */
    `Expected isIncomplete to be '${
      expectedCompletionList.isIncomplete
    }' but got '${actualCompletions.isIncomplete}'
expected:
${JSON.stringify(expectedCompletionList, undefined, 2)}
but got (actual):
${JSON.stringify(actualCompletions, undefined, 2)}`,
    /* eslint-enable @typescript-eslint/restrict-template-expressions */
  )

  assert.deepStrictEqual(
    actualCompletions.items.map((items) => items.label),
    expectedCompletionList.items.map((items) => items.label),
    'mapped items => item.label',
  )

  assert.deepStrictEqual(
    actualCompletions.items.map((item) => item.kind),
    expectedCompletionList.items.map((item) => item.kind),
    'mapped items => item.kind',
  )

  assert.deepStrictEqual(
    actualCompletions.items.length,
    expectedCompletionList.items.length,
    // eslint-disable-next-line  @typescript-eslint/restrict-template-expressions
    `Expected ${expectedCompletionList.items.length} suggestions and got ${
      actualCompletions.items.length
    }: ${JSON.stringify(actualCompletions.items, undefined, 2)}`, // TODO only 1 value is output here :(
  )

  assert.deepStrictEqual(
    actualCompletions.items.length,
    expectedCompletionList.items.length,
    'items.length',
  )
}

const dataSourceWithUri = getDocUri('completions/datasourceWithUrl.prisma')
const namedConstraintsUri = getDocUri('completions/namedConstraints.prisma')
const emptyBlocksUri = getDocUri('completions/emptyBlocks.prisma')
const modelBlocksUri = getDocUri('completions/modelBlocks.prisma')
const enumCommentUri = getDocUri('completions/enumWithComments.prisma')
const emptyDocUri = getDocUri('completions/empty.prisma')
const sqliteDocUri = getDocUri('completions/datasourceWithSqlite.prisma')
const relationDirectiveUri = getDocUri('completions/relationDirective.prisma')
const relationDirectiveSqlserverReferentialActionsUri = getDocUri(
  'completions/relationDirectiveSqlserverReferentialActions.prisma',
)
const fullTextIndex_extendedIndexes_mongodb = getDocUri(
  'completions/fullTextIndex_extendedIndexes_mongodb.prisma',
)
const fullTextIndex_extendedIndexes_postgresql = getDocUri(
  'completions/fullTextIndex_extendedIndexes_postgresql.prisma',
)
const fullTextIndex_extendedIndexes_mysql = getDocUri(
  'completions/fullTextIndex_extendedIndexes_mysql.prisma',
)

const fieldPreviewFeatures = {
  label: 'previewFeatures',
  kind: vscode.CompletionItemKind.Field,
}
const fieldProvider = {
  label: 'provider',
  kind: vscode.CompletionItemKind.Field,
}

suite('Completions', () => {
  suite('BASE BLOCKS', () => {
    test('Diagnoses block type suggestions with sqlite as provider', async () => {
      await testCompletion(
        sqliteDocUri,
        new vscode.Position(4, 0),
        new vscode.CompletionList(
          [
            { label: 'datasource', kind: vscode.CompletionItemKind.Class },
            { label: 'generator', kind: vscode.CompletionItemKind.Class },
            { label: 'model', kind: vscode.CompletionItemKind.Class },
          ],
          false,
        ),
        false,
      )
    })

    test('Diagnoses block type suggestions for empty file', async () => {
      await testCompletion(
        emptyDocUri,
        new vscode.Position(0, 0),
        new vscode.CompletionList(
          [
            { label: 'datasource', kind: vscode.CompletionItemKind.Class },
            { label: 'enum', kind: vscode.CompletionItemKind.Class },
            { label: 'generator', kind: vscode.CompletionItemKind.Class },
            { label: 'model', kind: vscode.CompletionItemKind.Class },
          ],
          false,
        ),
        false,
      )
    })
  })

  suite('DATABASE BLOCK', () => {
    const fieldUrl = { label: 'url', kind: vscode.CompletionItemKind.Field }
    const fieldShadowDatabaseUrl = {
      label: 'shadowDatabaseUrl',
      kind: vscode.CompletionItemKind.Field,
    }
    const sqlite = { label: 'sqlite', kind: vscode.CompletionItemKind.Constant }
    const mysql = { label: 'mysql', kind: vscode.CompletionItemKind.Constant }
    const postgresql = {
      label: 'postgresql',
      kind: vscode.CompletionItemKind.Constant,
    }
    const mssql = {
      label: 'sqlserver',
      kind: vscode.CompletionItemKind.Constant,
    }
    const array = { label: '[]', kind: vscode.CompletionItemKind.Property }
    const quotationMarks = {
      label: '""',
      kind: vscode.CompletionItemKind.Property,
    }
    const envArgument = {
      label: 'DATABASE_URL',
      kind: vscode.CompletionItemKind.Constant,
    }
    const env = { label: 'env()', kind: vscode.CompletionItemKind.Property }

    test('Diagnoses datasource field suggestions in empty block', async () => {
      await testCompletion(
        emptyBlocksUri,
        new vscode.Position(1, 0),
        new vscode.CompletionList([
          fieldProvider,
          fieldShadowDatabaseUrl,
          fieldUrl,
        ]),
        false,
      )
    })

    test('Diagnoses datasource field suggestions with existing field', async () => {
      await testCompletion(
        sqliteDocUri,
        new vscode.Position(2, 0),
        new vscode.CompletionList([fieldShadowDatabaseUrl, fieldUrl]),
        false,
      )
      await testCompletion(
        dataSourceWithUri,
        new vscode.Position(2, 0),
        new vscode.CompletionList([fieldProvider, fieldShadowDatabaseUrl]),
        false,
      )
    })

    test('Diagnoses url argument suggestions for datasource block', async () => {
      await testCompletion(
        dataSourceWithUri,
        new vscode.Position(7, 10),
        new vscode.CompletionList([quotationMarks, env], true),
        false,
      ),
        await testCompletion(
          dataSourceWithUri,
          new vscode.Position(11, 15),
          new vscode.CompletionList([envArgument], false),
          true,
        )
    })

    test('Diagnoses single provider suggestions for datasource block', async () => {
      await testCompletion(
        sqliteDocUri,
        new vscode.Position(14, 14),
        new vscode.CompletionList([mysql, postgresql, sqlite, mssql], true),
        false,
      ),
        await testCompletion(
          sqliteDocUri,
          new vscode.Position(18, 13),
          new vscode.CompletionList([quotationMarks, array], true),
          false,
        )
    })

    test('Diagnoses multiple provider suggestions for datasource block', async () => {
      await testCompletion(
        sqliteDocUri,
        new vscode.Position(6, 15),
        new vscode.CompletionList([mysql, postgresql, sqlite, mssql], true),
        true,
      ),
        await testCompletion(
          sqliteDocUri,
          new vscode.Position(22, 14),
          new vscode.CompletionList([quotationMarks], true),
          true,
        )
      await testCompletion(
        sqliteDocUri,
        new vscode.Position(10, 25),
        new vscode.CompletionList([mysql, postgresql, mssql], true),
        true,
      )
    })
  })

  suite('GENERATOR BLOCK', () => {
    const fieldOutput = {
      label: 'output',
      kind: vscode.CompletionItemKind.Field,
    }
    const fieldBinaryTargets = {
      label: 'binaryTargets',
      kind: vscode.CompletionItemKind.Field,
    }
    const fieldEngineType = {
      label: 'engineType',
      kind: vscode.CompletionItemKind.Field,
    }

    const generatorWithExistingFieldsUri = getDocUri(
      'completions/generatorWithExistingFields.prisma',
    )
    const generatorWithdataProxyPreviewFeature = getDocUri(
      'completions/generatorWithdataProxyPreviewFeature.prisma',
    )

    test('Diagnoses generator field suggestions in empty block', async () => {
      await testCompletion(
        emptyBlocksUri,
        new vscode.Position(5, 0),
        new vscode.CompletionList([
          fieldBinaryTargets,
          fieldEngineType,
          fieldOutput,
          fieldPreviewFeatures,
          fieldProvider,
        ]),
        false,
      )
    })

    test('Diagnoses generator field suggestions with existing fields', async () => {
      await activate(generatorWithExistingFieldsUri)
      await testCompletion(
        generatorWithExistingFieldsUri,
        new vscode.Position(2, 0),
        new vscode.CompletionList([
          fieldBinaryTargets,
          fieldEngineType,
          fieldOutput,
          fieldPreviewFeatures,
        ]),
        true,
      )
      await testCompletion(
        generatorWithExistingFieldsUri,
        new vscode.Position(7, 0),
        new vscode.CompletionList([
          fieldBinaryTargets,
          fieldEngineType,
          fieldPreviewFeatures,
          fieldProvider,
        ]),
        true,
      )
    })

    test('engineType = |', async () => {
      await testCompletion(
        generatorWithExistingFieldsUri,
        new vscode.Position(11, 17),
        new vscode.CompletionList(
          [
            {
              label: '""',
              kind: vscode.CompletionItemKind.Property,
            },
          ],
          true,
        ),
        false,
      )
    })
    test('engineType = "|"', async () => {
      await testCompletion(
        generatorWithExistingFieldsUri,
        new vscode.Position(15, 18),
        new vscode.CompletionList(
          [
            {
              label: 'binary',
              kind: vscode.CompletionItemKind.Constant,
            },
            {
              label: 'library',
              kind: vscode.CompletionItemKind.Constant,
            },
          ],
          true,
        ),
        false,
      )
    })
    // With Preview Feature Flag
    test('dataProxy: engineType = ""', async () => {
      await testCompletion(
        generatorWithdataProxyPreviewFeature,
        new vscode.Position(2, 21),
        new vscode.CompletionList(
          [
            {
              label: 'binary',
              kind: vscode.CompletionItemKind.Constant,
            },
            {
              label: 'dataproxy',
              kind: vscode.CompletionItemKind.Constant,
            },
            {
              label: 'library',
              kind: vscode.CompletionItemKind.Constant,
            },
          ],
          true,
        ),
        false,
      )
    })
  })

  suite('BLOCK ATTRIBUTES', () => {
    const blockAttributeId = {
      label: '@@id',
      kind: vscode.CompletionItemKind.Property,
    }
    const blockAttributeMap = {
      label: '@@map',
      kind: vscode.CompletionItemKind.Property,
    }
    const blockAttributeUnique = {
      label: '@@unique',
      kind: vscode.CompletionItemKind.Property,
    }
    const blockAttributeIndex = {
      label: '@@index',
      kind: vscode.CompletionItemKind.Property,
    }
    const blockAttributeFulltextIndex = {
      label: '@@fulltext',
      kind: vscode.CompletionItemKind.Property,
    }
    const blockAttributeIgnore = {
      label: '@@ignore',
      kind: vscode.CompletionItemKind.Property,
    }

    test('Diagnoses block attribute suggestions first in a line', async () => {
      await testCompletion(
        emptyBlocksUri,
        new vscode.Position(9, 0),
        new vscode.CompletionList([
          blockAttributeId,
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        false,
      )
    })

    test('Diagnoses block attribute suggestions with existing attributes first in a line', async () => {
      await activate(modelBlocksUri)
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(5, 0),
        new vscode.CompletionList([
          blockAttributeId,
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(14, 0),
        new vscode.CompletionList([
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        true,
      )
    })

    //
    // previewFeatures = ["fullTextIndex"]
    // = tests which are feature preview / database dependent
    //
    test('fullTextIndex - Diagnoses block attribute suggestions first in a line - mysql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_mysql,
        new vscode.Position(14, 2),
        new vscode.CompletionList([
          // blockAttributeId,
          blockAttributeFulltextIndex,
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        false,
      )
    })

    test('fullTextIndex - Diagnoses block attribute suggestions first in a line - mongodb', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_mongodb,
        new vscode.Position(14, 2),
        new vscode.CompletionList([
          // blockAttributeId,
          blockAttributeFulltextIndex,
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        false,
      )
    })

    test('fullTextIndex - Diagnoses block attribute suggestions first in a line - postgresql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_postgresql,
        new vscode.Position(14, 2),
        new vscode.CompletionList([
          // blockAttributeId,
          // blockAttributeFulltextIndex,
          blockAttributeIgnore,
          blockAttributeIndex,
          blockAttributeMap,
          blockAttributeUnique,
        ]),
        false,
      )
    })
  })

  suite('TYPES', () => {
    test('Diagnoses type suggestions in model block', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(51, 7),
        new vscode.CompletionList(
          [
            { label: 'BigInt', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Boolean', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Bytes', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Cat', kind: vscode.CompletionItemKind.Reference },
            { label: 'DateTest', kind: vscode.CompletionItemKind.Reference },
            {
              label: 'DateTime',
              kind: vscode.CompletionItemKind.TypeParameter,
            },
            { label: 'Decimal', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Float', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'ForthUser', kind: vscode.CompletionItemKind.Reference },
            { label: 'Hello', kind: vscode.CompletionItemKind.Reference },
            { label: 'Int', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Json', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Person', kind: vscode.CompletionItemKind.Reference },
            { label: 'Post', kind: vscode.CompletionItemKind.Reference },
            { label: 'SecondUser', kind: vscode.CompletionItemKind.Reference },
            { label: 'String', kind: vscode.CompletionItemKind.TypeParameter },
            { label: 'Test', kind: vscode.CompletionItemKind.Reference },
            { label: 'ThirdUser', kind: vscode.CompletionItemKind.Reference },
            { label: 'TypeCheck', kind: vscode.CompletionItemKind.Reference },
            {
              label: 'Unsupported',
              kind: vscode.CompletionItemKind.TypeParameter,
            },
            { label: 'User', kind: vscode.CompletionItemKind.Reference },
            { label: 'UserType', kind: vscode.CompletionItemKind.Reference },
          ],
          true,
        ),
        true,
      )
    })
  })

  suite('FIELD ATTRIBUTES', () => {
    const fieldAttributeId = {
      label: '@id',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeUnique = {
      label: '@unique',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeMap = {
      label: '@map',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeDefault = {
      label: '@default',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeRelation = {
      label: '@relation',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeUpdatedAt = {
      label: '@updatedAt',
      kind: vscode.CompletionItemKind.Property,
    }
    const fieldAttributeIgnore = {
      label: '@ignore',
      kind: vscode.CompletionItemKind.Property,
    }
    const functionCuid = {
      label: 'cuid()',
      kind: vscode.CompletionItemKind.Function,
    }
    const functionUuid = {
      label: 'uuid()',
      kind: vscode.CompletionItemKind.Function,
    }
    const functionAutoInc = {
      label: 'autoincrement()',
      kind: vscode.CompletionItemKind.Function,
    }
    const functionNow = {
      label: 'now()',
      kind: vscode.CompletionItemKind.Function,
    }
    const functionDbGenerated = {
      label: 'dbgenerated("")',
      kind: vscode.CompletionItemKind.Function,
    }
    const staticValueTrue = {
      label: 'true',
      kind: vscode.CompletionItemKind.Value,
    }
    const staticValueFalse = {
      label: 'false',
      kind: vscode.CompletionItemKind.Value,
    }
    const fieldsProperty = {
      label: 'fields',
      kind: vscode.CompletionItemKind.Property,
    }
    const referencesProperty = {
      label: 'references',
      kind: vscode.CompletionItemKind.Property,
    }
    const onDeleteProperty = {
      label: 'onDelete',
      kind: vscode.CompletionItemKind.Property,
    }
    const onUpdateProperty = {
      label: 'onUpdate',
      kind: vscode.CompletionItemKind.Property,
    }
    const nameQuotesProperty = {
      label: '""',
      kind: vscode.CompletionItemKind.Property,
    }
    const nameProperty = {
      label: 'name',
      kind: vscode.CompletionItemKind.Property,
    }
    const mapProperty = {
      label: 'map',
      kind: vscode.CompletionItemKind.Property,
    }
    const typeProperty = {
      label: 'type',
      kind: vscode.CompletionItemKind.Property,
    }

    test('Diagnoses field and block attribute suggestions', async () => {
      await activate(modelBlocksUri)

      await testCompletion(
        modelBlocksUri,
        new vscode.Position(18, 14),
        new vscode.CompletionList([
          fieldAttributeDefault,
          fieldAttributeId,
          fieldAttributeIgnore,
          fieldAttributeMap,
          fieldAttributeRelation,
          fieldAttributeUnique,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(19, 14),
        new vscode.CompletionList([
          fieldAttributeDefault,
          fieldAttributeIgnore,
          fieldAttributeMap,
          fieldAttributeRelation,
          fieldAttributeUnique,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(61, 20),
        new vscode.CompletionList([
          fieldAttributeDefault,
          fieldAttributeIgnore,
          fieldAttributeMap,
          fieldAttributeRelation,
          fieldAttributeUnique,
          fieldAttributeUpdatedAt,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(13, 16),
        new vscode.CompletionList([
          fieldAttributeDefault,
          fieldAttributeIgnore,
          fieldAttributeMap,
          fieldAttributeRelation,
          fieldAttributeUnique,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(74, 24),
        new vscode.CompletionList([
          { label: 'lastName', kind: vscode.CompletionItemKind.Field },
        ]),
        true,
      )
    })

    test('Diagnoses functions as default values', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(11, 24),
        new vscode.CompletionList([functionAutoInc, functionDbGenerated]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(28, 27),
        new vscode.CompletionList([
          functionCuid,
          functionDbGenerated,
          functionUuid,
        ]),
        true,
      )
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(30, 36),
        new vscode.CompletionList([functionDbGenerated, functionNow]),
        true,
      )
    })

    test('Diagnoses static default values', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(24, 28),
        new vscode.CompletionList([
          functionDbGenerated,
          staticValueFalse,
          staticValueTrue,
        ]),
        true,
      )
    })

    test('Diagnoses default suggestions for enum values', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(62, 27),
        new vscode.CompletionList([
          { label: 'ADMIN', kind: vscode.CompletionItemKind.Value },
          functionDbGenerated,
          { label: 'NORMAL', kind: vscode.CompletionItemKind.Value },
        ]),
        false,
      )
    })

    test('Diagnoses default suggestions for enum values excluding comments', async () => {
      await testCompletion(
        enumCommentUri,
        new vscode.Position(11, 30),
        new vscode.CompletionList([
          { label: 'ADMIN', kind: vscode.CompletionItemKind.Value },
          functionDbGenerated,
          { label: 'NORMAL', kind: vscode.CompletionItemKind.Value },
        ]),
        false,
      )
    })

    test('@@unique([|])', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(38, 15),
        new vscode.CompletionList([
          { label: 'firstName', kind: vscode.CompletionItemKind.Field },
          { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
          { label: 'lastName', kind: vscode.CompletionItemKind.Field },
        ]),
        true,
      )
    })

    test('@@id([|])', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(46, 10),
        new vscode.CompletionList([
          { label: 'firstName', kind: vscode.CompletionItemKind.Field },
          { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
          { label: 'lastName', kind: vscode.CompletionItemKind.Field },
        ]),
        true,
      )
    })

    test('@@index([|])', async () => {
      await testCompletion(
        modelBlocksUri,
        new vscode.Position(47, 13),
        new vscode.CompletionList([
          { label: 'firstName', kind: vscode.CompletionItemKind.Field },
          { label: 'isAdmin', kind: vscode.CompletionItemKind.Field },
          { label: 'lastName', kind: vscode.CompletionItemKind.Field },
        ]),
        true,
      )
    })

    // previewFeatures = ["extendedIndexes"]
    // provider = "postgresql"
    test('extendedIndexes: @@index(|) - postgresql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_postgresql,
        new vscode.Position(15, 10),
        new vscode.CompletionList([fieldsProperty, mapProperty, typeProperty]),
        true,
      )
    })
    test('extendedIndexes: @@index([title], |) - postgresql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_postgresql,
        new vscode.Position(16, 19),
        new vscode.CompletionList([fieldsProperty, mapProperty, typeProperty]),
        true,
      )
    })
    test('extendedIndexes: @@index([title], type: |) - postgresql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_postgresql,
        new vscode.Position(17, 25),
        new vscode.CompletionList([
          { label: 'BTree', kind: vscode.CompletionItemKind.Enum },
          { label: 'Hash', kind: vscode.CompletionItemKind.Enum },
        ]),
        true,
      )
    })
    test('extendedIndexes: @@index([title], type: Hash, |) - postgresql', async () => {
      await testCompletion(
        fullTextIndex_extendedIndexes_postgresql,
        new vscode.Position(18, 31),
        new vscode.CompletionList([fieldsProperty, mapProperty]),
        true,
      )
    })

    suite('Diagnoses arguments of @relation directive', function () {
      test('@relation(|)', async () => {
        await activate(relationDirectiveUri)

        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(12, 26),
          new vscode.CompletionList([
            nameQuotesProperty,
            fieldsProperty,
            mapProperty,
            nameProperty,
            onDeleteProperty,
            onUpdateProperty,
            referencesProperty,
          ]),
          true,
        )
      })
      test('@relation(references: [|])', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(21, 39),
          new vscode.CompletionList([
            { label: 'id', kind: vscode.CompletionItemKind.Field },
            { label: 'items', kind: vscode.CompletionItemKind.Field },
            { label: 'total', kind: vscode.CompletionItemKind.Field },
          ]),
          true,
        )
      })
      test('@relation(references: [id], |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(30, 44),
          new vscode.CompletionList([
            nameQuotesProperty,
            fieldsProperty,
            mapProperty,
            nameProperty,
            onDeleteProperty,
            onUpdateProperty,
          ]),
          true,
        )
      })
      test('order Order @relation(fields: [orderId], |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(39, 45),
          new vscode.CompletionList([
            nameQuotesProperty,
            mapProperty,
            nameProperty,
            onDeleteProperty,
            onUpdateProperty,
            referencesProperty,
          ]),
          true,
        )
      })
      test('@relation(fields: [|])', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(48, 35),
          new vscode.CompletionList([
            { label: 'id', kind: vscode.CompletionItemKind.Field },
            { label: 'orderId', kind: vscode.CompletionItemKind.Field },
            { label: 'productName', kind: vscode.CompletionItemKind.Field },
            { label: 'productPrice', kind: vscode.CompletionItemKind.Field },
            { label: 'quantity', kind: vscode.CompletionItemKind.Field },
          ]),
          true,
        )
      })
      test('@relation(fields: [orderId], references: [id], |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(57, 62),
          new vscode.CompletionList([
            nameQuotesProperty,
            mapProperty,
            nameProperty,
            onDeleteProperty,
            onUpdateProperty,
          ]),
          true,
        )
      })
      test('@relation(onDelete: |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(66, 36),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'Restrict', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })
      test('@relation(onUpdate: |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(75, 36),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'Restrict', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })
      test('@relation(fields: [orderId], references: [id], onDelete: |)', async () => {
        await testCompletion(
          relationDirectiveUri,
          new vscode.Position(84, 73),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'Restrict', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })

      // SQL Server datasource
      test('sqlserver: @relation(onDelete: |)', async () => {
        await testCompletion(
          relationDirectiveSqlserverReferentialActionsUri,
          new vscode.Position(15, 36),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })
      test('sqlserver: @relation(onUpdate: |)', async () => {
        await testCompletion(
          relationDirectiveSqlserverReferentialActionsUri,
          new vscode.Position(24, 36),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })
      test('sqlserver: @relation(fields: [orderId], references: [id], onDelete: |)', async () => {
        await testCompletion(
          relationDirectiveSqlserverReferentialActionsUri,
          new vscode.Position(33, 73),
          new vscode.CompletionList([
            { label: 'Cascade', kind: vscode.CompletionItemKind.Enum },
            { label: 'NoAction', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetDefault', kind: vscode.CompletionItemKind.Enum },
            { label: 'SetNull', kind: vscode.CompletionItemKind.Enum },
          ]),
          true,
        )
      })

      //
      // previewFeatures = ["fullTextIndex"]
      // = tests which are feature preview / database dependent
      //
      test('@@fulltext(|) - mysql', async () => {
        await testCompletion(
          fullTextIndex_extendedIndexes_mysql,
          new vscode.Position(15, 13),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          false,
        )
      })
      test('@@fulltext([title, content], |) - mysql', async () => {
        await testCompletion(
          fullTextIndex_extendedIndexes_mysql,
          new vscode.Position(16, 31),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          false,
        )
      })

      test('@@fulltext(|) - mongodb', async () => {
        await testCompletion(
          fullTextIndex_extendedIndexes_mongodb,
          new vscode.Position(15, 13),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          false,
        )
      })
      test('@@fulltext([title, content], |) - mongodb', async () => {
        await testCompletion(
          fullTextIndex_extendedIndexes_mongodb,
          new vscode.Position(16, 31),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          false,
        )
      })
    })

    suite('namedConstraints', function () {
      test('@id(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(11, 20),
          new vscode.CompletionList([mapProperty]),
          true,
        )
      })
      test('@@id(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(17, 9),
          new vscode.CompletionList([
            fieldsProperty,
            mapProperty,
            nameProperty,
          ]),
          true,
        )
      })
      test('@@id([orderId, something], |)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(23, 31),
          new vscode.CompletionList([
            fieldsProperty,
            mapProperty,
            nameProperty,
          ]),
          true,
        )
      })

      test('@unique(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(27, 25),
          new vscode.CompletionList([mapProperty]),
          true,
        )
      })
      test('@@unique(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(34, 13),
          new vscode.CompletionList([
            fieldsProperty,
            mapProperty,
            nameProperty,
          ]),
          true,
        )
      })
      test('@@unique([email, something], |)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(40, 33),
          new vscode.CompletionList([
            fieldsProperty,
            mapProperty,
            nameProperty,
          ]),
          true,
        )
      })

      test('@@index(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(48, 12),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          true,
        )
      })
      test('@@index([firstName, lastName], |)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(54, 35),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          true,
        )
      })

      test('@@fulltext(|)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(48, 12),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          true,
        )
      })
      test('@@fulltext([firstName, lastName], |)', async () => {
        await activate(namedConstraintsUri)

        await testCompletion(
          namedConstraintsUri,
          new vscode.Position(54, 35),
          new vscode.CompletionList([fieldsProperty, mapProperty]),
          true,
        )
      })
    })
  })
})
