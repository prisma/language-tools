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
import type { LanguageClient } from 'vscode-languageclient/node'
import { createBundledClientMiddleware, type BundledClientMiddleware } from './bundledClientMiddleware'
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
  middleware: BundledClientMiddleware
  ownership: DocumentOwnershipCoordinator
  client: LanguageClient
  documents: Map<string, TextDocument>
  diagnosticMessages: string[]
  isSnippetEdit: ReturnType<typeof vi.fn>
  sendRequest: ReturnType<typeof vi.fn>
  sendNotification: ReturnType<typeof vi.fn>
  deleteDiagnostics: ReturnType<typeof vi.fn>
} {
  const documents = new Map<string, TextDocument>()
  const diagnosticMessages: string[] = []
  const isSnippetEdit = vi.fn().mockReturnValue(true)
  const sendRequest = vi.fn()
  const sendNotification = vi.fn().mockResolvedValue(undefined)
  const deleteDiagnostics = vi.fn()
  const client = {
    code2ProtocolConverter: {
      asTextDocumentIdentifier: (textDocument: TextDocument) => ({ uri: textDocument.uri.toString() }),
      asOpenTextDocumentParams: (textDocument: TextDocument) => ({
        textDocument: {
          uri: textDocument.uri.toString(),
          languageId: textDocument.languageId,
          version: 1,
          text: textDocument.getText(),
        },
      }),
      asCloseTextDocumentParams: (textDocument: TextDocument) => ({
        textDocument: { uri: textDocument.uri.toString() },
      }),
      asRange: () => ({ start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }),
      asCodeActionContext: () => ({ diagnostics: [] }),
    },
    protocol2CodeConverter: {
      asCodeAction: (action: { title: string }) => ({ title: action.title, edit: { changes: {} } }),
      asCommand: (command: { title: string; command: string }) => command,
    },
    diagnostics: { delete: deleteDiagnostics },
    sendNotification,
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
    ownership,
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
    sendNotification,
    deleteDiagnostics,
  }
}

describe('bundled client ownership middleware', () => {
  test('balances bundled lifecycle notifications without duplicate opens or closes', async () => {
    const { middleware, ownership, sendNotification, deleteDiagnostics } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(schema)
    const didOpen = vi.fn()
    const didChange = vi.fn()
    const didClose = vi.fn()
    const change = { document: schema } as unknown as TextDocumentChangeEvent

    middleware.didOpen?.(schema, didOpen)
    middleware.didOpen?.(schema, didOpen)
    middleware.didChange?.(change, didChange)
    middleware.didClose?.(schema, didClose)
    middleware.didClose?.(schema, didClose)
    middleware.didOpen?.(schema, didOpen)
    middleware.didClose?.(schema, didClose)

    expect(didOpen).toHaveBeenCalledTimes(2)
    expect(didOpen).toHaveBeenCalledWith(schema)
    expect(didChange).toHaveBeenCalledOnce()
    expect(didChange).toHaveBeenCalledWith(change)
    expect(didClose).toHaveBeenCalledTimes(2)
    expect(didClose).toHaveBeenCalledWith(schema)
    expect(sendNotification).not.toHaveBeenCalled()
    expect(deleteDiagnostics).toHaveBeenCalledWith(schema.uri)
  })

  test('resynchronizes an open document exactly once after the bundled client restarts', async () => {
    const { middleware, ownership, client, sendNotification } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(schema)
    const oldDidOpen = vi.fn()
    const oldCompletion = { label: 'id' } as CompletionItem

    middleware.didOpen?.(schema, oldDidOpen)
    await middleware.provideCompletionItem?.(schema, position, completionContext, token, () => [oldCompletion])
    schema.setText('model User {\n  id Int @id\n  name String\n}')
    middleware.resetClientState()

    expect(middleware.resolveCompletionItem?.(oldCompletion, token, vi.fn())).toBeUndefined()

    const replacementOpenParams: unknown[] = []
    const replacementDidOpen = vi.fn((textDocument: TextDocument) => {
      replacementOpenParams.push(client.code2ProtocolConverter.asOpenTextDocumentParams(textDocument))
    })
    const replacementDidChange = vi.fn()
    const replacementDidClose = vi.fn()
    const change = { document: schema } as unknown as TextDocumentChangeEvent

    middleware.didOpen?.(schema, replacementDidOpen)
    middleware.didOpen?.(schema, replacementDidOpen)
    middleware.didChange?.(change, replacementDidChange)
    middleware.didClose?.(schema, replacementDidClose)
    middleware.didClose?.(schema, replacementDidClose)

    expect(oldDidOpen).toHaveBeenCalledOnce()
    expect(replacementDidOpen).toHaveBeenCalledOnce()
    expect(replacementOpenParams).toEqual([
      {
        textDocument: {
          uri: schema.uri.toString(),
          languageId: 'prisma',
          version: 1,
          text: schema.getText(),
        },
      },
    ])
    expect(replacementDidChange).toHaveBeenCalledOnce()
    expect(replacementDidChange).toHaveBeenCalledWith(change)
    expect(replacementDidClose).toHaveBeenCalledOnce()
    expect(replacementDidClose).toHaveBeenCalledWith(schema)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  test('suppresses a transition change without performing pre-commit lifecycle effects', async () => {
    const { middleware, ownership, sendNotification, deleteDiagnostics } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(schema)
    const didOpen = vi.fn()
    const didChange = vi.fn()

    middleware.didOpen?.(schema, didOpen)
    schema.setText('// use prisma-next\nmodel User { id Int @id }')
    const markedChange = { document: schema } as unknown as TextDocumentChangeEvent
    middleware.didChange?.(markedChange, didChange)
    middleware.didChange?.(markedChange, didChange)

    expect(didChange).not.toHaveBeenCalled()
    expect(sendNotification).not.toHaveBeenCalled()
    expect(deleteDiagnostics).not.toHaveBeenCalled()
  })

  test('opens a coordinator-reacquired document with complete current text exactly once', async () => {
    const { middleware, ownership, sendNotification } = createSubject()
    const schema = document('file:///workspace/schema.prisma', '// use prisma-next')
    const didChange = vi.fn()

    schema.setText('model User {\n  id Int @id\n  name String\n}')
    await ownership.synchronize(schema)
    middleware.openDocument(schema)
    middleware.openDocument(schema)
    const unmarkedChange = { document: schema } as unknown as TextDocumentChangeEvent

    expect(didChange).not.toHaveBeenCalled()
    expect(sendNotification).toHaveBeenCalledOnce()
    expect(sendNotification).toHaveBeenCalledWith('textDocument/didOpen', {
      textDocument: {
        uri: schema.uri.toString(),
        languageId: 'prisma',
        version: 1,
        text: schema.getText(),
      },
    })

    middleware.didChange?.(unmarkedChange, didChange)
    expect(didChange).toHaveBeenCalledOnce()
    expect(sendNotification).toHaveBeenCalledOnce()
  })

  test('forwards a real close for every URI still tracked by the bundled server', async () => {
    const { middleware, ownership, sendNotification, deleteDiagnostics } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(schema)
    const didOpen = vi.fn()
    const didChange = vi.fn()
    const didClose = vi.fn()

    middleware.didOpen?.(schema, didOpen)
    schema.setText('// use prisma-next')
    middleware.didClose?.(schema, didClose)

    expect(didClose).toHaveBeenCalledOnce()
    expect(didClose).toHaveBeenCalledWith(schema)
    expect(sendNotification).not.toHaveBeenCalled()
    expect(deleteDiagnostics).toHaveBeenCalledWith(schema.uri)

    const reopened = document('file:///workspace/reopened.prisma', 'model User { id Int @id }')
    await ownership.synchronize(reopened)
    middleware.didOpen?.(reopened, didOpen)
    reopened.setText('// use prisma-next')
    middleware.didChange?.({ document: reopened } as unknown as TextDocumentChangeEvent, didChange)
    middleware.didClose?.(reopened, didClose)

    expect(sendNotification).not.toHaveBeenCalled()
    expect(didClose).toHaveBeenCalledTimes(2)
    expect(didClose).toHaveBeenLastCalledWith(reopened)
  })

  test('gates every advertised document request while preserving unmarked forwarding', async () => {
    const { middleware, ownership } = createSubject()
    const marked = document('file:///workspace/marked.prisma', '// use prisma-next')
    const unmarked = document('file:///workspace/unmarked.prisma', 'model User { id Int @id }')
    await ownership.synchronize(unmarked)

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

  test('clears diagnostics when a document loses bundled ownership', async () => {
    const { middleware, ownership, documents, diagnosticMessages } = createSubject()
    const schema = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(schema)
    documents.set(schema.uri.toString(), schema)
    const diagnostics = [{ message: 'bundled diagnostic' }] as Diagnostic[]
    const next = vi.fn()

    middleware.handleDiagnostics?.(schema.uri, diagnostics, next)
    schema.setText('// use prisma-next')
    middleware.handleDiagnostics?.(schema.uri, diagnostics, next)
    schema.setText('model User { id Int @id }')
    documents.delete(schema.uri.toString())
    middleware.handleDiagnostics?.(schema.uri, diagnostics, next)

    expect(next.mock.calls).toEqual([
      [schema.uri, diagnostics],
      [schema.uri, []],
      [schema.uri, []],
    ])
    expect(diagnosticMessages).toEqual(['bundled diagnostic'])
  })

  test('keeps code-action conversion ownership-gated', async () => {
    const { middleware, ownership, sendRequest, isSnippetEdit } = createSubject()
    sendRequest.mockResolvedValue([
      {
        title: 'Insert block',
        kind: 'quickfix',
        edit: { changes: { 'file:///workspace/schema.prisma': [] } },
      },
    ] as never)
    const unmarked = document('file:///workspace/schema.prisma', 'model User { id Int @id }')
    await ownership.synchronize(unmarked)

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

  test('allows pinned marked documents to stay synchronized with the bundled client', async () => {
    const { middleware, ownership } = createSubject({ pinned: true })
    const schema = document('file:///workspace/schema.prisma', '// use prisma-next')
    await ownership.synchronize(schema)
    const didOpen = vi.fn()
    const didChange = vi.fn()
    const change = { document: schema } as unknown as TextDocumentChangeEvent

    middleware.didOpen?.(schema, didOpen)
    middleware.didChange?.(change, didChange)

    expect(didOpen).toHaveBeenCalledWith(schema)
    expect(didChange).toHaveBeenCalledWith(change)
  })
})
