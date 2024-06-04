import { DocumentSymbol, SymbolKind } from 'vscode-languageserver'
import { describe, test, expect } from 'vitest'
import { handleDocumentSymbol } from '../lib/MessageHandler'
import { getTextDocument } from './helper'

function assertSymbols(fixturePath: string, expected: DocumentSymbol[]) {
  const textDocument = getTextDocument(fixturePath)
  const actual = handleDocumentSymbol({ textDocument }, textDocument)

  expect(actual).toStrictEqual(expected)
}

describe('DocumentSymbol', () => {
  const getFixturePath = (testName: string) => `./hover/${testName}.prisma`
  test('hover_postgresql.prisma', () => {
    const fixturePath = getFixturePath('postgresql')
    assertSymbols(fixturePath, [
      {
        kind: SymbolKind.Struct,
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
            line: 17,
          },
          start: {
            character: 0,
            line: 11,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 11,
          },
          start: {
            character: 6,
            line: 11,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'User',
        range: {
          end: {
            character: 1,
            line: 27,
          },
          start: {
            character: 0,
            line: 20,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 20,
          },
          start: {
            character: 6,
            line: 20,
          },
        },
      },
      {
        kind: SymbolKind.Enum,
        name: 'UserName',
        range: {
          end: {
            character: 1,
            line: 33,
          },
          start: {
            character: 0,
            line: 30,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 30,
          },
          start: {
            character: 5,
            line: 30,
          },
        },
      },
      {
        kind: SymbolKind.Enum,
        name: 'Test',
        range: {
          end: {
            character: 1,
            line: 39,
          },
          start: {
            character: 0,
            line: 36,
          },
        },
        selectionRange: {
          end: {
            character: 9,
            line: 36,
          },
          start: {
            character: 5,
            line: 36,
          },
        },
      },
    ])
  })

  test('hover_mongodb.prisma', () => {
    const fixturePath = getFixturePath('mongodb')
    assertSymbols(fixturePath, [
      {
        kind: SymbolKind.Function,
        name: 'client',
        range: {
          end: {
            character: 1,
            line: 2,
          },
          start: {
            character: 0,
            line: 0,
          },
        },
        selectionRange: {
          end: {
            character: 16,
            line: 0,
          },
          start: {
            character: 10,
            line: 0,
          },
        },
      },
      {
        kind: SymbolKind.Struct,
        name: 'db',
        range: {
          end: {
            character: 1,
            line: 7,
          },
          start: {
            character: 0,
            line: 4,
          },
        },
        selectionRange: {
          end: {
            character: 13,
            line: 4,
          },
          start: {
            character: 11,
            line: 4,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'Post',
        range: {
          end: {
            character: 1,
            line: 15,
          },
          start: {
            character: 0,
            line: 9,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 9,
          },
          start: {
            character: 6,
            line: 9,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'User',
        range: {
          end: {
            character: 1,
            line: 24,
          },
          start: {
            character: 0,
            line: 17,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 17,
          },
          start: {
            character: 6,
            line: 17,
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: 'EmbedHolder',
        range: {
          end: {
            character: 1,
            line: 35,
          },
          start: {
            character: 0,
            line: 26,
          },
        },
        selectionRange: {
          end: {
            character: 17,
            line: 26,
          },
          start: {
            character: 6,
            line: 26,
          },
        },
      },
      {
        kind: SymbolKind.Interface,
        name: 'Embed',
        range: {
          end: {
            character: 1,
            line: 44,
          },
          start: {
            character: 0,
            line: 37,
          },
        },
        selectionRange: {
          end: {
            character: 10,
            line: 37,
          },
          start: {
            character: 5,
            line: 37,
          },
        },
      },
      {
        kind: SymbolKind.Interface,
        name: 'EmbedEmbed',
        range: {
          end: {
            character: 1,
            line: 49,
          },
          start: {
            character: 0,
            line: 46,
          },
        },
        selectionRange: {
          end: {
            character: 15,
            line: 46,
          },
          start: {
            character: 5,
            line: 46,
          },
        },
      },
    ])
  })
})
