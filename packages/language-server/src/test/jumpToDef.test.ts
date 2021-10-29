import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import { handleDefinitionRequest } from '../MessageHandler'
import { Location, Range } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertJumpToDefinition(
  position: Position,
  expectedRange: Range,
  fixturePath: string,
): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params = {
    textDocument: document,
    position: position,
  }
  const defResult: Location | undefined = handleDefinitionRequest(
    document,
    params,
  )

  assert.ok(defResult !== undefined)
  assert.deepStrictEqual(defResult.range, expectedRange)
}

suite('Jump-to-Definition', () => {
  const fixturePath = './correct.prisma'

  test('Diagnoses jump from attribute to model', () => {
    assertJumpToDefinition(
      {
        character: 9,
        line: 22,
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
    assertJumpToDefinition(
      {
        character: 14,
        line: 14,
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
        character: 16,
        line: 11,
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
  })
})
