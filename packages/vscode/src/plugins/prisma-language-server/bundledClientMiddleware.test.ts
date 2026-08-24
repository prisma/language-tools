import { describe, expect, test, vi } from 'vitest'
import type {
  CancellationToken,
  CodeAction,
  CodeActionContext,
  CompletionContext,
  CompletionItem,
  Diagnostic,
  FormattingOptions,
  Position,
  Range,
  TextDocument,
  TextDocumentChangeEvent,
  Uri,
  WorkspaceFolder,
} from 'vscode'
import type { LanguageClient, Middleware } from 'vscode-languageclient/node'
import { createBundledClientMiddleware } from './bundledClientMiddleware'
import { DocumentOwnershipCoordinator } from './documentOwnership'

const position = {} as Position
const range = {} as Range
const token = {} as CancellationToken
const completionContext = {} as CompletionContext
const formattingOptions = {} as FormattingOptions
const codeActionContext = { diagnostics: [] } as unknown as CodeActionContext
const root = workspaceFolder('file:///workspace')

function uri(value: string): Uri {
  return {
    scheme: value.slice(0, value.indexOf(':')),
    toString: () => value,
  } as Uri
}

function workspaceFolder(value: string): WorkspaceFolder {
  return { uri: uri(value) } as WorkspaceFolder
}

function document(value: string, text: string): TextDocument & { setText(nextText: string): void } {
  let currentText = text
  return {
    uri: uri(value),
    languageId: 'prisma',
    getText: () => currentText,
    setText: (nextText: string) => {
      currentText = nextText
    },
  } as TextDocument & { setText(nextText: string): void }
}

function createSubject(options: { pinned?: boolean } = {}): {
  middleware: Middleware
  client: LanguageClient
  documents: Map<string, TextDocument>
  diagnosticMessages: string[]
  isSnippetEdit: ReturnType<typeof vi.fn>
  sendRequest: ReturnType<typeof vi.fn>
} {
  const documents = new Map<string, TextDocument>()
  const diagnosticMessages: string[] = []
  const isSnippetEdit = vi.fn().mockReturnValue(true)
  const sendRequest = vi.fn()
  const client = {
    code2ProtocolConverter: {
      asTextDocumentIdentifier: (textDocument: TextDocument) => ({ uri: textDocument.uri.toString() }),
      asRange: () => ({ start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }),
      asCodeActionContext: () => ({ diagnostics: [] }),
    },
    protocol2CodeConverter: {
      asCodeAction: (action: { title: string }) => ({ title: action.title, edit: { changes: {} } }),
      asCommand: (command: { title: string; command: string }) => command,
    },
    sendRequest,
  } as unknown as LanguageClient
  const ownership = new DocumentOwnershipCoordinator({
    workspace: {
      isTrusted: true,
      getWorkspaceFolder: (documentUri) => (documentUri.toString().startsWith(root.uri.toString()) ? root : undefined),
    },
    policy: { isPinnedToPrisma6: () => options.pinned ?? false },
  })

  return {
    middleware: createBundledClientMiddleware({
      ownership,
      getClient: () => client,
      getDocument: (documentUri) => documents.get(documentUri.toString()),
      handleDiagnosticMessage: (message) => diagnosticMessages.push(message),
      isSnippetEdit,
    }),
    client,
    documents,
    diagnosticMessages,
    isSnippetEdit,
    sendRequest,
  }
}

describe('bundled client ownership middleware', () => {
  test('does not forward marked document lifecycle notifications', () => {
    const { middleware } = createSubject()
    const schema = document('file:///workspace/schema.prisma', '// use prisma-next')
    const next = vi.fn()

    middleware.didOpen?.(schema, next)
    middleware.didChange?.({ document: schema } as unknown as TextDocumentChangeEvent, next)
    middleware.didClose?.(schema, next)

    expect(next).not.toHaveBeenCalled()
  })

  test('forwards unmarked document lifecycle notifications', () => {
    const { middleware } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    const didOpen = vi.fn()
    const didChange = vi.fn()
    const didClose = vi.fn()
    const change = { document: schema } as unknown as TextDocumentChangeEvent

    middleware.didOpen?.(schema, didOpen)
    middleware.didChange?.(change, didChange)
    middleware.didClose?.(schema, didClose)

    expect(didOpen).toHaveBeenCalledWith(schema)
    expect(didChange).toHaveBeenCalledWith(change)
    expect(didClose).toHaveBeenCalledWith(schema)
  })

  test('gates every advertised document request while preserving unmarked forwarding', async () => {
    const { middleware } = createSubject()
    const marked = document('file:///workspace/marked.prisma', '// use prisma-next')
    const unmarked = document('file:///workspace/unmarked.prisma', 'model User { id Int @id }')

    const completionItem = { label: 'id' } as CompletionItem
    const completionNext = vi.fn().mockReturnValue([completionItem])
    expect(
      middleware.provideCompletionItem?.(marked, position, completionContext, token, completionNext),
    ).toBeUndefined()
    await expect(
      middleware.provideCompletionItem?.(unmarked, position, completionContext, token, completionNext),
    ).resolves.toEqual([{ label: 'id' }])

    const resolveNext = vi.fn().mockReturnValue(completionItem)
    expect(middleware.resolveCompletionItem?.(completionItem, token, resolveNext)).toBe(completionItem)
    unmarked.setText('// use prisma-next')
    expect(middleware.resolveCompletionItem?.(completionItem, token, resolveNext)).toBeUndefined()

    const markedNext = vi.fn()
    expect(middleware.provideHover?.(marked, position, token, markedNext)).toBeUndefined()
    expect(middleware.provideDefinition?.(marked, position, token, markedNext)).toBeUndefined()
    expect(
      middleware.provideReferences?.(marked, position, { includeDeclaration: true }, token, markedNext),
    ).toBeUndefined()
    expect(middleware.provideDocumentSymbols?.(marked, token, markedNext)).toBeUndefined()
    expect(middleware.provideDocumentFormattingEdits?.(marked, formattingOptions, token, markedNext)).toBeUndefined()
    expect(middleware.provideRenameEdits?.(marked, position, 'Renamed', token, markedNext)).toBeUndefined()
    expect(markedNext).not.toHaveBeenCalled()

    const forwarded = Symbol('forwarded')
    const unmarkedNext = vi.fn().mockReturnValue(forwarded)
    unmarked.setText('model User { id Int @id }')
    expect(middleware.provideHover?.(unmarked, position, token, unmarkedNext)).toBe(forwarded)
    expect(middleware.provideDefinition?.(unmarked, position, token, unmarkedNext)).toBe(forwarded)
    expect(middleware.provideReferences?.(unmarked, position, { includeDeclaration: true }, token, unmarkedNext)).toBe(
      forwarded,
    )
    expect(middleware.provideDocumentSymbols?.(unmarked, token, unmarkedNext)).toBe(forwarded)
    expect(middleware.provideDocumentFormattingEdits?.(unmarked, formattingOptions, token, unmarkedNext)).toBe(
      forwarded,
    )
    expect(middleware.provideRenameEdits?.(unmarked, position, 'Renamed', token, unmarkedNext)).toBe(forwarded)
  })

  test('clears diagnostics when a document loses bundled ownership', () => {
    const { middleware, documents, diagnosticMessages } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    documents.set(schema.uri.toString(), schema)
    const diagnostics = [{ message: 'bundled diagnostic' }] as Diagnostic[]
    const next = vi.fn()

    middleware.handleDiagnostics?.(schema.uri, diagnostics, next)
    schema.setText('// use prisma-next')
    middleware.handleDiagnostics?.(schema.uri, diagnostics, next)

    expect(next.mock.calls).toEqual([
      [schema.uri, diagnostics],
      [schema.uri, []],
    ])
    expect(diagnosticMessages).toEqual(['bundled diagnostic'])
  })

  test('keeps code-action conversion ownership-gated', async () => {
    const { middleware, sendRequest, isSnippetEdit } = createSubject()
    sendRequest.mockResolvedValue([
      {
        title: 'Insert block',
        kind: 'quickfix',
        edit: { changes: { 'file:///workspace/schema.prisma': [] } },
      },
    ] as never)
    const unmarked = document('file:///workspace/schema.prisma', 'model User { id Int @id }')

    const actions = await middleware.provideCodeActions?.(unmarked, range, codeActionContext, token, vi.fn())

    expect(sendRequest).toHaveBeenCalledOnce()
    expect(isSnippetEdit).toHaveBeenCalledOnce()
    expect(actions).toEqual([
      {
        title: 'Insert block',
        command: {
          command: 'prisma.applySnippetWorkspaceEdit',
          title: '',
          arguments: [{ changes: {} }],
        },
        edit: undefined,
      } satisfies CodeAction,
    ])

    unmarked.setText('// use prisma-next')
    expect(await middleware.provideCodeActions?.(unmarked, range, codeActionContext, token, vi.fn())).toBeUndefined()
    expect(sendRequest).toHaveBeenCalledOnce()
  })

  test('allows pinned marked documents to use the bundled client', () => {
    const { middleware } = createSubject({ pinned: true })
    const schema = document('file:///workspace/schema.prisma', '// use prisma-next')
    const next = vi.fn()

    middleware.didOpen?.(schema, next)

    expect(next).toHaveBeenCalledWith(schema)
  })
})
