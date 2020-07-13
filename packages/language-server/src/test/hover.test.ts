import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import { handleHoverRequest } from '../MessageHandler'
import * as fs from 'fs'
import * as path from 'path'
import { Hover } from 'vscode-languageserver'
import * as assert from 'assert'

function assertHover(
  position: Position,
  expected: Hover,
  fixturePath: string,
): void {
  const content: string = fs.readFileSync(
    path.join(__dirname, '../../../test/fixtures', fixturePath),
    'utf8',
  )
  const document = TextDocument.create(fixturePath, 'prisma', 1, content)

  const params = {
    textDocument: document,
    position: position,
  }
  const hoverResult: Hover | undefined = handleHoverRequest(document, params)

  assert.ok(hoverResult !== undefined)
  assert.deepEqual(hoverResult.contents, expected.contents)
  assert.deepEqual(hoverResult.range, expected.range)
}

suite('Hover of /// documentation comments', () => {
  const fixturePath = './hover.prisma'

  test('Model', () => {
    assertHover(
      {
        character: 10,
        line: 23,
      },
      {
        contents: 'Post including an author and content.',
      },
      fixturePath,
    )
  })
  test('Enum', () => {
    assertHover(
      {
        character: 17,
        line: 24,
      },
      {
        contents: 'This is an enum specifying the UserName.',
      },
      fixturePath,
    )
  })
})
