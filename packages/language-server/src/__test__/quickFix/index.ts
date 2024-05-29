import { expect } from 'vitest'
import { CodeAction, Range, Diagnostic, CodeActionParams, DiagnosticSeverity } from 'vscode-languageserver'
import { PrismaSchema } from '../../lib/Schema'
import { quickFix } from '../../lib/code-actions'
import { TextDocument } from 'vscode-languageserver-textdocument'

export function assertQuickFix(
  expected: CodeAction[],
  textDocument: TextDocument,
  range: Range,
  diagnostics: Diagnostic[],
): void {
  const params: CodeActionParams = {
    textDocument: {
      uri: textDocument.uri,
    },
    context: {
      diagnostics,
    },
    range,
  }

  const quickFixResult: CodeAction[] = quickFix(PrismaSchema.singleFile(textDocument), textDocument, params)
  expect(quickFixResult.length).toBeGreaterThan(0)

  expect(quickFixResult).toStrictEqual(expected)
}

export function createDiagnosticErrorUnknownType(unknownType: string, range: Range): Diagnostic {
  return {
    message: `Type "${unknownType}" is neither a built-in type, nor refers to another model, custom type, or enum.`,
    severity: DiagnosticSeverity.Error,
    range: range,
  }
}
