import { handleDocumentFormatting } from '../lib/MessageHandler'
import { TextEdit, DocumentFormattingParams } from 'vscode-languageserver'
import { describe, test, expect } from 'vitest'
import { getTextDocument } from './helper'
import { PrismaSchema } from '../lib/Schema'
import { isSameFileUri } from '../lib/prisma-schema-wasm/format'

function assertFormat(fixturePath: string): void {
  const textDocument = getTextDocument(fixturePath)
  const params: DocumentFormattingParams = {
    textDocument,
    options: {
      tabSize: 2,
      insertSpaces: true,
    },
  }

  const formatResult: TextEdit[] = handleDocumentFormatting(PrismaSchema.singleFile(textDocument), textDocument, params)

  expect(formatResult.length).toBeGreaterThan(0)
}

describe('Format', () => {
  const fixturePath = './formatting/autoFormat.prisma'

  test('Format should do something', () => {
    assertFormat(fixturePath)
  })
})

describe('Format URI matching', () => {
  test('matches equivalent Windows file URIs', () => {
    expect(
      isSameFileUri(
        'file:///z%3A/kevin_new/prisma-database-kevin/Doku.prisma',
        'file:///Z:/kevin_new/prisma-database-kevin/Doku.prisma',
        'win32',
      ),
    ).toBe(true)
  })

  test('keeps Unix paths case-sensitive', () => {
    expect(isSameFileUri('file:///tmp/schema.prisma', 'file:///tmp/schema.prisma', 'linux')).toBe(true)

    expect(isSameFileUri('file:///tmp/schema.prisma', 'file:///tmp/Schema.prisma', 'linux')).toBe(false)
  })
})
