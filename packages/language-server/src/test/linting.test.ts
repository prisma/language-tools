import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDiagnosticsRequest } from '../MessageHandler'
import { getBinPath, binaryIsNeeded, getDownloadURL } from '../prisma-fmt/util'
import install from '../prisma-fmt/install'
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

async function assertLinting(
  expected: Diagnostic[],
  fixturePath: string,
): Promise<void> {
  const document: TextDocument = getTextDocument(fixturePath)

  const diagnosticsResults: Diagnostic[] = await handleDiagnosticsRequest(
    document,
    binPathPrismaFmt,
  )

  assert.ok(diagnosticsResults.length != 0)
  expected.forEach((expectedDiagnostic, i) => {
    const actualDiagnostic = diagnosticsResults[i]
    assert.strictEqual(actualDiagnostic.message, expectedDiagnostic.message)
    assert.deepStrictEqual(actualDiagnostic.range, expectedDiagnostic.range)
    assert.strictEqual(actualDiagnostic.severity, expectedDiagnostic.severity)
  })
}

// Cache prisma-fmt binary path
let binPathPrismaFmt = ''

suite('Linting', () => {
  suiteSetup(async () => {
    // install prisma-fmt binary
    if (binPathPrismaFmt === '') {
      binPathPrismaFmt = await getBinPath()
    }
    if (binaryIsNeeded(binPathPrismaFmt)) {
      await install(await getDownloadURL(), binPathPrismaFmt)
    }
  })

  const fixturePathMissingArgument = './linting/missingArgument.prisma'
  const fixturePathWrongType = './linting/wrongType.prisma'
  const fixturePathRequiredField = './linting/requiredField.prisma'

  test('Missing argument', async () => {
    await assertLinting(
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
  test('Wrong type', async () => {
    await assertLinting(
      [
        {
          message:
            'Type "Use" is neither a built-in type, nor refers to another model, custom type, or enum.',
          range: {
            start: { line: 14, character: 12 },
            end: { line: 14, character: 16 },
          },
          severity: DiagnosticSeverity.Error,
        },
      ],
      fixturePathWrongType,
    )
  })
  test('Required field', async () => {
    await assertLinting(
      [
        {
          message:
            'Error validating: The relation field `author` uses the scalar fields authorId. At least one of those fields is required. Hence the relation field must be required as well.',
          range: {
            start: { line: 14, character: 2 },
            end: { line: 15, character: 0 },
          },
          severity: DiagnosticSeverity.Error,
        },
      ],
      fixturePathRequiredField,
    )
  })
})
