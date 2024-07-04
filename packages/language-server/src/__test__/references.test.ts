import { assert, describe, expect, test } from 'vitest'
import { CURSOR_CHARACTER, findCursorPosition, getTextDocument } from './helper'
import { Location, ReferenceParams } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleReferencesRequest } from '../lib/MessageHandler'
import { PrismaSchema } from '../lib/Schema'
import { getMultifileHelper } from './MultifileHelper'

const getReferences = async () => {
  const helper = await getMultifileHelper('references')

  const file = helper.file('types.prisma')

  const position = file.findAndReplaceCursor()

  const params: ReferenceParams = {
    textDocument: { uri: file.uri },
    position,
    context: { includeDeclaration: true },
  }

  return handleReferencesRequest(helper.schema, params)
}
describe('References', () => {
  test('references e2e', async () => {
    const references = await getReferences()

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
})
