import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as assert from 'assert'
import { handleDocumentSymbol } from '../MessageHandler'
import { getTextDocument } from './helper'

function assertSymbols(fixturePath: string, expected: DocumentSymbol[]) {
  const document: TextDocument = getTextDocument(fixturePath)
  const actual = handleDocumentSymbol({ textDocument: document }, document)
  assert.deepStrictEqual(actual, expected)
}

suite('DocumentSymbol', () => {
  test('hover.prisma', () => {
    assertSymbols('./hover.prisma', [
      {
        kind: SymbolKind.Interface,
        name: 'db',
        range: {
          end: {
            character: 1,
            line: 3,
          },
          start: {
            character: 0,
            line: 0,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 0,
          },
          start: {
            character: 11,
            line: 0,
          },
        },
      },
      {
        kind: SymbolKind.Function,
        name: 'client',
        range: {
          end: {
            character: 1,
            line: 7,
          },
          start: {
            character: 0,
            line: 5,
          },
        },
        selectionRange: {
          end: {
            character: 16,
            line: 5,
          },
          start: {
            character: 10,
            line: 5,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'Post',
        range: {
          end: {
            character: 1,
            line: 16,
          },
          start: {
            character: 0,
            line: 10,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 10,
          },
          start: {
            character: 6,
            line: 10,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'User',
        range: {
          end: {
            character: 1,
            line: 26,
          },
          start: {
            character: 0,
            line: 19,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 19,
          },
          start: {
            character: 6,
            line: 19,
          },
        },
      },
      {
        kind: 10,
        name: 'UserName',
        range: {
          end: {
            character: 1,
            line: 32,
          },
          start: {
            character: 0,
            line: 29,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 29,
          },
          start: {
            character: 5,
            line: 29,
          },
        },
      },
      {
        kind: 10,
        name: 'Test',
        range: {
          end: {
            character: 1,
            line: 38,
          },
          start: {
            character: 0,
            line: 35,
          },
        },
        selectionRange: {
          end: {
            character: 9,
            line: 35,
          },
          start: {
            character: 5,
            line: 35,
          },
        },
      },
    ])
  })
})
