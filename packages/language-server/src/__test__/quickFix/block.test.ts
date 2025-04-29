import { describe, test, vi } from 'vitest'
import { Range, CodeActionKind } from 'vscode-languageserver'
import { fixturePathToUri, getTextDocument } from '../helper'
import { assertQuickFix } from '.'
import { handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { PrismaSchema } from '../../lib/Schema'

const isWindows = process.platform === 'win32'

describe('blocks', () => {
  const getFixturePath = (testName: string) => `./codeActions/blocks/${testName}.prisma`

  // Newline differences with windows, courtesy of \r\n.
  const range: Range = isWindows
    ? {
        start: { line: 12, character: 1 },
        end: { line: 12, character: 2 },
      }
    : {
        start: { line: 12, character: 1 },
        end: { line: 13, character: 0 },
      }

  const newLine = isWindows ? '\r\n' : '\n'

  test('create missing block in composite type', () => {
    const fixturePath = getFixturePath('unknown_type_composite_type')
    const expectedPath = fixturePathToUri(fixturePath)
    const document = getTextDocument(fixturePath)

    const onError = vi.fn()
    const diagnostics = handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError).get(expectedPath)

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
                  newText: `${newLine}type Animal {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}enum Animal {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}model Address {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}enum Address {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}type Address {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}model Animal {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}enum Animal {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}model Animol {${newLine}${newLine}}${newLine}`,
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
                  newText: `${newLine}enum Animol {${newLine}${newLine}}${newLine}`,
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
