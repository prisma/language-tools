import { describe, expect, test } from 'vitest'
import { Position, ReferenceParams } from 'vscode-languageserver'
import { handleReferencesRequest } from '../lib/MessageHandler'
import { PrismaSchema } from '../lib/Schema'
import { getMultifileHelper } from './MultifileHelper'

const getReferences = async (uri: string, schema: PrismaSchema, position: Position) => {
  const params: ReferenceParams = {
    textDocument: { uri: uri },
    position,
    context: { includeDeclaration: true },
  }

  return handleReferencesRequest(schema, params)
}
describe('References', async () => {
  const helper = await getMultifileHelper('references')

  test('of a composite type block name', async () => {
    const file = helper.file('types.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('type Address').characterAfter('Addr'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 12,
              "line": 1,
            },
            "start": {
              "character": 5,
              "line": 1,
            },
          },
          "uri": "file:///references/types.prisma",
        },
        {
          "range": {
            "end": {
              "character": 19,
              "line": 6,
            },
            "start": {
              "character": 12,
              "line": 6,
            },
          },
          "uri": "file:///references/models.prisma",
        },
        {
          "range": {
            "end": {
              "character": 19,
              "line": 6,
            },
            "start": {
              "character": 12,
              "line": 6,
            },
          },
          "uri": "file:///references/views.prisma",
        },
      ]
    `)
  })

  test('of a composite type as a field type', async () => {
    const file = helper.file('models.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('address Address').characterAfter('Addr'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 12,
              "line": 1,
            },
            "start": {
              "character": 5,
              "line": 1,
            },
          },
          "uri": "file:///references/types.prisma",
        },
        {
          "range": {
            "end": {
              "character": 19,
              "line": 6,
            },
            "start": {
              "character": 12,
              "line": 6,
            },
          },
          "uri": "file:///references/models.prisma",
        },
        {
          "range": {
            "end": {
              "character": 19,
              "line": 6,
            },
            "start": {
              "character": 12,
              "line": 6,
            },
          },
          "uri": "file:///references/views.prisma",
        },
      ]
    `)
  })

  test('of a model block name', async () => {
    const file = helper.file('models.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('model Post').characterAfter('Po'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 10,
              "line": 14,
            },
            "start": {
              "character": 6,
              "line": 14,
            },
          },
          "uri": "file:///references/models.prisma",
        },
        {
          "range": {
            "end": {
              "character": 16,
              "line": 3,
            },
            "start": {
              "character": 12,
              "line": 3,
            },
          },
          "uri": "file:///references/models.prisma",
        },
        {
          "range": {
            "end": {
              "character": 15,
              "line": 4,
            },
            "start": {
              "character": 11,
              "line": 4,
            },
          },
          "uri": "file:///references/views.prisma",
        },
      ]
    `)
  })

  test('of a model relation as a field type', async () => {
    const file = helper.file('models.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('author   User').characterAfter('Us'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 10,
              "line": 0,
            },
            "start": {
              "character": 6,
              "line": 0,
            },
          },
          "uri": "file:///references/models.prisma",
        },
        {
          "range": {
            "end": {
              "character": 17,
              "line": 17,
            },
            "start": {
              "character": 13,
              "line": 17,
            },
          },
          "uri": "file:///references/models.prisma",
        },
      ]
    `)
  })

  test('of a field from relation fields', async () => {
    const file = helper.file('models.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('author   User').characterAfter('fields: [auth'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 12,
              "line": 16,
            },
            "start": {
              "character": 4,
              "line": 16,
            },
          },
          "uri": "file:///references/models.prisma",
        },
      ]
    `)
  })

  test('of a field from relation fields', async () => {
    const file = helper.file('models.prisma')

    const references = await getReferences(
      file.uri,
      helper.schema,
      file.lineContaining('author   User').characterAfter('references: [i'),
    )

    expect(references).not.toBeUndefined()
    expect(references).toMatchInlineSnapshot(`
      [
        {
          "range": {
            "end": {
              "character": 6,
              "line": 1,
            },
            "start": {
              "character": 4,
              "line": 1,
            },
          },
          "uri": "file:///references/models.prisma",
        },
      ]
    `)
  })
})
