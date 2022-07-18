import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDiagnosticsRequest } from '../MessageHandler'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertLinting(expected: Diagnostic[], fixturePath: string): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const diagnosticsResults: Diagnostic[] = handleDiagnosticsRequest(document)

  assert.ok(diagnosticsResults.length != 0)
  expected.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = diagnosticsResults[i]
    assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message)
    assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range)
    assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity)
  })
}

suite('Linting', () => {
  const fixturePathMissingArgument = './linting/missingArgument.prisma'
  const fixturePathWrongType = './linting/wrongType.prisma'

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
          message: 'Type "Use" is neither a built-in type, nor refers to another model, custom type, or enum.',
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
})
