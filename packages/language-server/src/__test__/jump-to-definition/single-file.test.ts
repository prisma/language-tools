import { expect, describe, test } from 'vitest'
import { Position, Range, LocationLink } from 'vscode-languageserver'
import { handleDefinitionRequest } from '../../lib/MessageHandler'
import { PrismaSchema } from '../../lib/Schema'
import { getTextDocument } from '../helper'

function assertJumpToDefinition(position: Position, expectedRange: Range, fixturePath: string): void {
  const textDocument = getTextDocument(fixturePath)

  const params = { textDocument, position }
  const defResult: LocationLink[] | undefined = handleDefinitionRequest(
    PrismaSchema.singleFile(textDocument),
    textDocument,
    params,
  )

  expect(defResult).not.toBeUndefined()
  expect(defResult?.[0]?.targetRange).toStrictEqual(expectedRange)
}

describe('Jump-to-Definition', () => {
  const getFixturePath = (testName: string) => `./jump-to-definition/${testName}.prisma`

  test('SQLite: from attribute to model', () => {
    const fixturePath = getFixturePath('correct_sqlite')
    assertJumpToDefinition(
      {
        line: 11,
        character: 16,
      },
      {
        start: {
          line: 26,
          character: 0,
        },
        end: {
          line: 31,
          character: 1,
        },
      },
      fixturePath,
    )
    assertJumpToDefinition(
      {
        line: 14,
        character: 14,
      },
      {
        start: {
          line: 18,
          character: 0,
        },
        end: {
          line: 24,
          character: 1,
        },
      },
      fixturePath,
    )
    assertJumpToDefinition(
      {
        line: 22,
        character: 9,
      },
      {
        start: {
          line: 9,
          character: 0,
        },
        end: {
          line: 16,
          character: 1,
        },
      },
      fixturePath,
    )
  })

  test('MongoDB: from attribute to type', () => {
    const fixturePath = getFixturePath('correct_mongodb')
    assertJumpToDefinition(
      {
        line: 12,
        character: 11,
      },
      {
        start: {
          line: 15,
          character: 0,
        },
        end: {
          line: 19,
          character: 1,
        },
      },
      fixturePath,
    )
  })
})
