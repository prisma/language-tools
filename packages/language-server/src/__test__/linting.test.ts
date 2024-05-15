import { handleDiagnosticsRequest } from '../lib/MessageHandler'
import { describe, expect, test } from 'vitest'
import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'
import { getTextDocument } from './helper'
import { MAX_SAFE_VALUE_i32 } from '../lib/constants'
import listAllAvailablePreviewFeatures from '../lib/prisma-schema-wasm/listAllAvailablePreviewFeatures'
import { PrismaSchema } from '../lib/Schema'

function assertLinting(expected: Diagnostic[], fixturePath: string): void {
  const document = getTextDocument(fixturePath)

  const diagnosticsResults: Diagnostic[] = handleDiagnosticsRequest(PrismaSchema.singleFile(document)).get(document.uri)

  expect(diagnosticsResults.length).toBeGreaterThan(0)
  expected.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = diagnosticsResults[i]
    expect(actualDiagnostic.message).toStrictEqual(expectedDiagnostic.message)
    expect(actualDiagnostic.range).toStrictEqual(expectedDiagnostic.range)
    expect(actualDiagnostic.severity).toStrictEqual(expectedDiagnostic.severity)
    expect(actualDiagnostic.tags).toStrictEqual(expectedDiagnostic.tags)
  })
}

describe('Linting', () => {
  const fixturePathMissingArgument = './linting/missingArgument.prisma'
  const fixturePathWrongType = './linting/wrongType.prisma'
  const fixturePathFieldIgnore = './linting/@ignore.prisma'
  const fixturePathModelIgnore = './linting/@@ignore.prisma'
  const fixturePathUnknownPreview = './linting/unknownPreview.prisma'

  test('Missing argument', () => {
    assertLinting(
      [
        {
          message: 'Argument "provider" is missing in data source block "db".',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 2, character: 1 },
          },
          severity: DiagnosticSeverity.Error,
        },
      ],
      fixturePathMissingArgument,
    )
  })

  test('Wrong type', () => {
    assertLinting(
      [
        {
          message: 'Type "Use" is neither a built-in type, nor refers to another model, composite type, or enum.',
          range: {
            start: { line: 14, character: 12 },
            end: { line: 14, character: 15 },
          },
          severity: DiagnosticSeverity.Error,
        },
      ],
      fixturePathWrongType,
    )
  })

  test('@ignore : Field', () => {
    assertLinting(
      [
        {
          range: {
            start: { line: 12, character: 0 },
            end: { line: 12, character: MAX_SAFE_VALUE_i32 },
          },
          message:
            '@ignore: When using Prisma Migrate, this field will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
        },
      ],
      fixturePathFieldIgnore,
    )
  })

  test('@@ignore : Model', () => {
    assertLinting(
      [
        {
          range: {
            start: { line: 9, character: 0 },
            end: { line: 17, character: 1 },
          },
          message:
            '@@ignore: When using Prisma Migrate, this model will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
        },
      ],
      fixturePathModelIgnore,
    )
  })

  test('Unknown previewFeature', () => {
    const previewFeatures = listAllAvailablePreviewFeatures()

    assertLinting(
      [
        {
          message: `The preview feature "huh" is not known. Expected one of: ${previewFeatures.join(', ')}.
If this is unexpected, it might be due to your Prisma VS Code Extension being out of date.`,
          range: {
            start: { line: 2, character: 22 },
            end: { line: 2, character: 29 },
          },
          severity: DiagnosticSeverity.Error,
        },
      ],
      fixturePathUnknownPreview,
    )
  })
})
