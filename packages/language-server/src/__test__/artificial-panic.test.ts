import { CodeActionParams, CompletionParams, DocumentFormattingParams } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  handleCodeActions,
  handleCompletionRequest,
  handleDiagnosticsRequest,
  handleDocumentFormatting,
} from '../lib/MessageHandler'
import { CURSOR_CHARACTER, findCursorPosition, getTextDocument } from './helper'
import { describe, test, expect, vi, afterEach } from 'vitest'
import '../lib/prisma-schema-wasm/error/wasm'

import { PrismaSchema } from '../lib/Schema'

describe('Artificial Panics', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const getFixturePath = (testName: string) => `./artificial-panic/${testName}.prisma`

  test('code actions', () => {
    const fixturePath = getFixturePath('schema')
    const document = getTextDocument(fixturePath)

    const params: CodeActionParams = {
      textDocument: document,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      context: {
        diagnostics: [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
            message: 'dx msg',
          },
        ],
      },
    }

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA', '1')
    const onError = vi.fn()

    handleCodeActions(PrismaSchema.singleFile(document), document, params, onError)
    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })

  test('formatter', () => {
    const fixturePath = getFixturePath('schema')
    const document = getTextDocument(fixturePath)

    const params: DocumentFormattingParams = {
      textDocument: document,
      options: {
        tabSize: 2,
        insertSpaces: true,
      },
    }

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA', '1')
    const onError = vi.fn()

    handleDocumentFormatting(PrismaSchema.singleFile(document), document, params, onError)
    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })

  test('linting', () => {
    const fixturePath = getFixturePath('schema')
    const document = getTextDocument(fixturePath)

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA', '1')
    const onError = vi.fn()

    handleDiagnosticsRequest(PrismaSchema.singleFile(document), onError)

    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })

  test('preview features', () => {
    const fixturePath = getFixturePath('schema')
    let document = getTextDocument(fixturePath)

    const schema = document.getText()

    const position = findCursorPosition(schema)

    document = TextDocument.create(
      './artificial-panic/schema.prisma',
      'prisma',
      1,
      schema.replace(CURSOR_CHARACTER, ''),
    )

    const params: CompletionParams = {
      textDocument: document,
      position,
    }

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA_LOCAL', '1')
    const onError = vi.fn()
    handleCompletionRequest(PrismaSchema.singleFile(document), document, params, onError)
    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })

  test('native types', () => {
    const fixturePath = getFixturePath('native-types')
    let document = getTextDocument(fixturePath)

    const schema = document.getText()

    const position = findCursorPosition(schema)

    document = TextDocument.create(
      './artificial-panic/native-types.prisma',
      'prisma',
      1,
      schema.replace(CURSOR_CHARACTER, ''),
    )

    const params: CompletionParams = {
      textDocument: document,
      position,
    }

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA_LOCAL', '1')
    const onError = vi.fn()

    handleCompletionRequest(PrismaSchema.singleFile(document), document, params, onError)
    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })

  test('completions', () => {
    const fixturePath = getFixturePath('schema')
    const document = getTextDocument(fixturePath)

    const params: CompletionParams = {
      textDocument: document,
      position: { character: 0, line: 0 },
    }

    vi.stubEnv('FORCE_PANIC_PRISMA_SCHEMA', '1')
    const onError = vi.fn()

    handleCompletionRequest(PrismaSchema.singleFile(document), document, params, onError)

    expect(onError).toBeCalledTimes(1)
    expect(onError).toBeCalledWith(expect.any(String))
  })
})
