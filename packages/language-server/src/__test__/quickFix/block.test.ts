import { describe, test, vi } from 'vitest'
import { Range, CodeActionKind } from 'vscode-languageserver'
import { fixturePathToUri, getTextDocument } from '../helper'
import { assertQuickFix } from '.'
import { handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { PrismaSchema } from '../../lib/Schema'

describe('blocks', () => {
  const getFixturePath = (testName: string) => `./codeActions/blocks/${testName}.prisma`
  test('create missing block in composite type', () => {
    const fixturePath = getFixturePath('unknown_type_composite_type')
    const expectedPath = fixturePathToUri(fixturePath)
    const document = getTextDocument(fixturePath)
    const onError = vi.fn()

    const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)
    const range: Range = {
      start: { line: 12, character: 1 },
      end: { line: 13, character: 0 },
    }

    assertQuickFix(
      [
        {
          title: "Create new type 'Animal'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\ntype Animal {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'Animal'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\nenum Animal {\n\n}\n',
                },
              ],
            },
          },
        },
      ],
      document,
      range,
      diagnostics,
    )
  })

  test('create missing block in model - mongodb', () => {
    const fixturePath = getFixturePath('unknown_type_model_mongodb')
    const expectedPath = fixturePathToUri(fixturePath)
    const document = getTextDocument(fixturePath)
    const onError = vi.fn()

    const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)

    const range: Range = {
      start: { line: 12, character: 1 },
      end: { line: 13, character: 0 },
    }

    assertQuickFix(
      [
        {
          title: "Create new model 'Address'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\nmodel Address {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'Address'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\nenum Address {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new type 'Address'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\ntype Address {\n\n}\n',
                },
              ],
            },
          },
        },
      ],
      document,
      range,
      diagnostics,
    )
  })

  test('create missing block in model - postgres', () => {
    const fixturePath = getFixturePath('unknown_type_model')
    const expectedPath = fixturePathToUri(fixturePath)
    const document = getTextDocument(fixturePath)
    const onError = vi.fn()

    const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)

    const range: Range = {
      start: { line: 12, character: 1 },
      end: { line: 13, character: 0 },
    }

    assertQuickFix(
      [
        {
          title: "Create new model 'Animal'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\nmodel Animal {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'Animal'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range,
                  newText: '\nenum Animal {\n\n}\n',
                },
              ],
            },
          },
        },
      ],
      document,
      range,
      diagnostics,
    )
  })

  test('spelling', () => {
    const fixturePath = getFixturePath('spelling')
    const expectedPath = fixturePathToUri(fixturePath)
    const document = getTextDocument(fixturePath)
    const onError = vi.fn()

    const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)

    const range: Range = {
      start: { line: 12, character: 1 },
      end: { line: 13, character: 0 },
    }
    const rangeSpelling = {
      start: { line: 11, character: 12 },
      end: { line: 11, character: 18 },
    }

    assertQuickFix(
      [
        {
          title: "Create new model 'Animol'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range: range,
                  newText: '\nmodel Animol {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Create new enum 'Animol'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range: range,
                  newText: '\nenum Animol {\n\n}\n',
                },
              ],
            },
          },
        },
        {
          title: "Change spelling to 'Animal'",
          kind: CodeActionKind.QuickFix,
          diagnostics,
          edit: {
            changes: {
              [expectedPath]: [
                {
                  range: rangeSpelling,
                  newText: 'Animal',
                },
              ],
            },
          },
        },
      ],
      document,
      range,
      diagnostics,
    )
  })
})
