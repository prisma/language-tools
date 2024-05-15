import type { Position } from 'vscode-languageserver-textdocument'
import { describe, test, expect } from 'vitest'
import { handleHoverRequest } from '../lib/MessageHandler'
import { Hover } from 'vscode-languageserver'
import { getTextDocument } from './helper'
import { PrismaSchema } from '../lib/Schema'

function assertHover(position: Position, expected: Hover, fixturePath: string): void {
  const textDocument = getTextDocument(fixturePath)

  const params = {
    textDocument,
    position: position,
  }
  const hoverResult: Hover | undefined = handleHoverRequest(PrismaSchema.singleFile(textDocument), textDocument, params)

  expect(hoverResult).not.toBeUndefined()
  expect(hoverResult?.contents).toStrictEqual(expected.contents)
  expect(hoverResult?.range).toStrictEqual(expected.range)
}

describe('Hover of /// documentation comments', () => {
  const fixturePath = './hover_postgresql.prisma'

  test('Model', () => {
    assertHover(
      {
        character: 15,
        line: 24,
      },
      {
        contents: "Post including an author, it's content\n\nand whether it was published",
      },
      fixturePath,
    )
  })
  test('Enum', () => {
    assertHover(
      {
        character: 15,
        line: 25,
      },
      {
        contents: 'This is an enum specifying the UserName.',
      },
      fixturePath,
    )
  })
})
