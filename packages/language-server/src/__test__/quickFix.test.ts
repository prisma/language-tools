import { TextDocument } from 'vscode-languageserver-textdocument'
import { quickFix } from '../codeActionProvider'
import {
  CodeAction,
  DiagnosticSeverity,
  CodeActionParams,
  CodeActionKind,
  Range,
  Diagnostic,
} from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

function assertQuickFix(
  expected: CodeAction[],
  fixturePath: string,
  range: Range,
  diagnostics: Diagnostic[],
): void {
  const document: TextDocument = getTextDocument(fixturePath)

  const params: CodeActionParams = {
    textDocument: document,
    context: {
      diagnostics: diagnostics,
    },
    range: range,
  }

  const quickFixResult: CodeAction[] = quickFix(document, params)

  assert.ok(quickFixResult.length !== 0)
  assert.deepStrictEqual(quickFixResult, expected)
}

function createDiagnosticErrorUnknownType(
  unknownType: string,
  range: Range,
): Diagnostic {
  return {
    message:
      'Type "' +
      unknownType +
      '" is neither a built-in type, nor refers to another model, custom type, or enum.',
    severity: DiagnosticSeverity.Error,
    range: range,
  }
}

suite('Quick Fix', () => {
  const fixturePath = './codeActions/quickFixes.prisma'

  const rangeNewModel: Range = {
    start: { line: 16, character: 9 },
    end: { line: 16, character: 17 },
  }
  const rangeNewEnum: Range = {
    start: { line: 24, character: 6 },
    end: { line: 24, character: 13 },
  }
  const rangePorst: Range = {
    start: { line: 31, character: 15 },
    end: { line: 31, character: 9 },
  }
  const rangeEdit: Range = {
    start: { line: 35, character: 0 },
    end: { line: 35, character: 0 },
  }

  const diagnosticsNewModel: Diagnostic[] = [
    createDiagnosticErrorUnknownType('NewModel', rangeNewModel),
  ]
  const diagnosticsNewEnum: Diagnostic[] = [
    createDiagnosticErrorUnknownType('NewEnum', rangeNewEnum),
  ]
  const diagnosticsPorst: Diagnostic[] = [
    createDiagnosticErrorUnknownType('Porst', rangePorst),
  ]

  test('Model/enum creations', () => {
    assertQuickFix(
      [
        {
          title: "Create new model 'NewModel'",
          kind: CodeActionKind.QuickFix,
          diagnostics: diagnosticsNewModel,
          edit: {
            changes: {
              [fixturePath]: [
                {
                  range: rangeEdit,
                  newText: '\nmodel NewModel {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'NewModel'",
          kind: CodeActionKind.QuickFix,
          diagnostics: diagnosticsNewModel,
          edit: {
            changes: {
              [fixturePath]: [
                {
                  range: rangeEdit,
                  newText: '\nenum NewModel {\n\n}\n',
                },
              ],
            },
          },
        },
      ],
      fixturePath,
      rangeNewModel,
      diagnosticsNewModel,
    ),
      assertQuickFix(
        [
          {
            title: "Create new model 'NewEnum'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsNewEnum,
            edit: {
              changes: {
                [fixturePath]: [
                  {
                    range: rangeEdit,
                    newText: '\nmodel NewEnum {\n\n}\n',
                  },
                ],
              },
            },
          },
          {
            title: "Create new enum 'NewEnum'",
            kind: CodeActionKind.QuickFix,
            diagnostics: diagnosticsNewEnum,
            edit: {
              changes: {
                [fixturePath]: [
                  {
                    range: rangeEdit,
                    newText: '\nenum NewEnum {\n\n}\n',
                  },
                ],
              },
            },
          },
        ],
        fixturePath,
        rangeNewEnum,
        diagnosticsNewEnum,
      )
  })
  test('Spelling suggestions and model/enum creations', () => {
    assertQuickFix(
      [
        {
          title: "Change spelling to 'Post'",
          kind: CodeActionKind.QuickFix,
          diagnostics: diagnosticsPorst,
          edit: {
            changes: {
              [fixturePath]: [
                {
                  range: rangePorst,
                  newText: 'Post?',
                },
              ],
            },
          },
        },
        {
          title: "Create new model 'Porst'",
          kind: CodeActionKind.QuickFix,
          diagnostics: diagnosticsPorst,
          edit: {
            changes: {
              [fixturePath]: [
                {
                  range: rangeEdit,
                  newText: '\nmodel Porst {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'Porst'",
          kind: CodeActionKind.QuickFix,
          diagnostics: diagnosticsPorst,
          edit: {
            changes: {
              [fixturePath]: [
                {
                  range: rangeEdit,
                  newText: '\nenum Porst {\n\n}\n',
                },
              ],
            },
          },
        },
      ],
      fixturePath,
      rangePorst,
      diagnosticsPorst,
    )
  })
})
