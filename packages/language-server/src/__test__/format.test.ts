import { handleDocumentFormatting } from '../lib/MessageHandler'
import { TextEdit, DocumentFormattingParams } from 'vscode-languageserver'
import { describe, test, expect } from 'vitest'
import { getTextDocument } from './helper'
import { PrismaSchema } from '../lib/Schema'

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
