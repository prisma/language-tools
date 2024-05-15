import { Position } from 'vscode-languageserver-textdocument'
import { describe, test, expect } from 'vitest'
import { handleDefinitionRequest } from '../lib/MessageHandler'
import { LocationLink, Range } from 'vscode-languageserver'
import { getTextDocument } from './helper'
import { PrismaSchema } from '../lib/Schema'

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
  const fixturePathSqlite = './correct_sqlite.prisma'
  const fixturePathMongodb = './correct_mongodb.prisma'

  test('SQLite: from attribute to model', () => {
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
      fixturePathSqlite,
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
      fixturePathSqlite,
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
      fixturePathSqlite,
    )
  })

  test('MongoDB: from attribute to type', () => {
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
      fixturePathMongodb,
    )
  })
})
