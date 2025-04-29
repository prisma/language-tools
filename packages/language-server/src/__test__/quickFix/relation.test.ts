import { describe, vi, test } from 'vitest'
import { CodeActionKind } from 'vscode-languageserver'
import { assertQuickFix } from '.'
import { handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { PrismaSchema } from '../../lib/Schema'
import { fixturePathToUri, getTextDocument } from '../helper'

describe('relations', () => {
  const getFixturePath = (testName: string) => `./codeActions/relations/${testName}.prisma`
  const fixturePath = getFixturePath('one_to_many_referenced_side_misses_unique_single_field')
  const expectedPath = fixturePathToUri(fixturePath)
  const document = getTextDocument(fixturePath)
  const onError = vi.fn()

  const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)

  test('@relation referenced side missing @unique', () => {
    assertQuickFix(
      [
        {
          title: 'Make referenced field(s) unique',
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range: {
                    start: { line: 7, character: 11 },
                    end: { line: 7, character: 11 },
                  },
                  newText: ' @unique',
                },
              ],
            },
          },
        },
      ],
      document,
      {
        start: { line: 14, character: 48 },
        end: { line: 14, character: 48 },
      },

      diagnostics,
    )
  })
})
