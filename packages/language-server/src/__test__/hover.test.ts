import type { Position } from 'vscode-languageserver-textdocument'
import { handleHoverRequest } from '../lib/MessageHandler'
import { Hover } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertHover(position: Position, expected: Hover, fixturePath: string): void {
  const textDocument = getTextDocument(fixturePath)

  const params = {
    textDocument,
    position: position,
  }
  const hoverResult: Hover | undefined = handleHoverRequest(textDocument, params)

  assert.ok(hoverResult !== undefined)
  assert.deepStrictEqual(hoverResult.contents, expected.contents)
  assert.deepStrictEqual(hoverResult.range, expected.range)
}

suite('Hover of /// documentation comments', () => {
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
