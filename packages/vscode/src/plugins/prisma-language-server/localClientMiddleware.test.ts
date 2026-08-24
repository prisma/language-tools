import { describe, expect, test, vi } from 'vitest'
import type {
  CancellationToken,
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
import { DocumentOwnershipCoordinator } from './documentOwnership'
import { createLocalClientMiddleware } from './localClientMiddleware'

const rootA = workspaceFolder('file:///workspace-a')
const rootB = workspaceFolder('file:///workspace-b')
const position = {} as Position
const range = {} as Range
const token = {} as CancellationToken
const completionContext = {} as CompletionContext
const formattingOptions = {} as FormattingOptions
const codeActionContext = { diagnostics: [] } as unknown as CodeActionContext

function uri(value: string): Uri {
  return { scheme: value.slice(0, value.indexOf(':')), toString: () => value } as Uri
}

function workspaceFolder(value: string): WorkspaceFolder {
  return { uri: uri(value), name: value } as WorkspaceFolder
}

function document(value: string, text: string): TextDocument & { setText(value: string): void } {
  let currentText = text
  return {
    uri: uri(value),
    languageId: 'prisma',
    version: 7,
    getText: () => currentText,
    setText: (value) => {
      currentText = value
    },
  } as TextDocument & { setText(value: string): void }
}

function createSubject() {
  const documents = new Map<string, TextDocument>()
  const sendNotification = vi.fn()
  const deleteDiagnostics = vi.fn()
  const client = {
    code2ProtocolConverter: {
      asOpenTextDocumentParams: (schema: TextDocument) => ({
        textDocument: {
          uri: schema.uri.toString(),
          languageId: schema.languageId,
          version: schema.version,
          text: schema.getText(),
        },
      }),
      asCloseTextDocumentParams: (schema: TextDocument) => ({ textDocument: { uri: schema.uri.toString() } }),
    },
    diagnostics: { delete: deleteDiagnostics },
    sendNotification,
  } as unknown as LanguageClient
  const ownership = new DocumentOwnershipCoordinator({
    workspace: {
      isTrusted: true,
      getWorkspaceFolder: (documentUri) =>
        documentUri.toString().includes('workspace-a')
          ? rootA
          : documentUri.toString().includes('workspace-b')
            ? rootB
            : undefined,
    },
    policy: { isPinnedToPrisma6: () => false },
  })
  const middleware = createLocalClientMiddleware({
    workspaceFolderUri: rootA.uri.toString(),
    ownership,
    getClient: () => client,
    getDocument: (documentUri) => documents.get(documentUri.toString()),
  })
  return { middleware, ownership, documents, sendNotification, deleteDiagnostics }
}

describe('local client ownership middleware', () => {
  test('filters automatic initial synchronization and never sends unmarked contents', async () => {
    const { middleware, ownership, sendNotification, deleteDiagnostics } = createSubject()
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next\nmodel User { id Int @id }')
    const unmarked = document('file:///workspace-a/unmarked.prisma', 'model Secret { id Int @id }')
    const automaticOpen = vi.fn()
    const changeNext = vi.fn()

    middleware.didOpen?.(schema, automaticOpen)
    middleware.didOpen?.(unmarked, automaticOpen)
    expect(automaticOpen).not.toHaveBeenCalled()

    await ownership.synchronize(schema)
    middleware.openDocument(schema)
    expect(sendNotification).toHaveBeenCalledWith('textDocument/didOpen', {
      textDocument: {
        uri: schema.uri.toString(),
        languageId: 'prisma',
        version: 7,
        text: schema.getText(),
      },
    })

    middleware.didChange?.({ document: schema } as unknown as TextDocumentChangeEvent, changeNext)
    expect(changeNext).toHaveBeenCalledOnce()

    schema.setText('model User { id Int @id leaked String }')
    middleware.didChange?.({ document: schema } as unknown as TextDocumentChangeEvent, changeNext)
    middleware.closeDocument(schema)
    middleware.clearDiagnostics(schema.uri)

    expect(changeNext).toHaveBeenCalledOnce()
    expect(sendNotification).toHaveBeenLastCalledWith('textDocument/didClose', {
      textDocument: { uri: schema.uri.toString() },
    })
    const notificationContents = sendNotification.mock.calls.flatMap(([, params]) => JSON.stringify(params))
    expect(notificationContents).not.toContain('leaked')
    expect(notificationContents).not.toContain('Secret')
    expect(deleteDiagnostics).toHaveBeenCalledWith(schema.uri)
  })

  test('forwards every document feature only for committed ownership in the exact root', async () => {
    const { middleware, ownership, documents } = createSubject()
    const owned = document('file:///workspace-a/schema.prisma', '// use prisma-next')
    const otherRoot = document('file:///workspace-b/schema.prisma', '// use prisma-next')
    documents.set(owned.uri.toString(), owned)
    await Promise.all([ownership.synchronize(owned), ownership.synchronize(otherRoot)])

    const completion = { label: 'id' } as CompletionItem
    const completionNext = vi.fn().mockReturnValue([completion])
    await expect(
      middleware.provideCompletionItem?.(owned, position, completionContext, token, completionNext),
    ).resolves.toEqual([completion])
    const resolveNext = vi.fn().mockReturnValue(completion)
    expect(middleware.resolveCompletionItem?.(completion, token, resolveNext)).toBe(completion)

    const next = vi.fn().mockReturnValue('forwarded')
    expect(middleware.provideHover?.(owned, position, token, next)).toBe('forwarded')
    expect(middleware.provideDefinition?.(owned, position, token, next)).toBe('forwarded')
    expect(middleware.provideReferences?.(owned, position, { includeDeclaration: true }, token, next)).toBe('forwarded')
    expect(middleware.provideDocumentSymbols?.(owned, token, next)).toBe('forwarded')
    expect(middleware.provideDocumentFormattingEdits?.(owned, formattingOptions, token, next)).toBe('forwarded')
    expect(middleware.provideRenameEdits?.(owned, position, 'Renamed', token, next)).toBe('forwarded')
    expect(middleware.provideCodeActions?.(owned, range, codeActionContext, token, next)).toBe('forwarded')

    const rejected = vi.fn()
    expect(middleware.provideHover?.(otherRoot, position, token, rejected)).toBeUndefined()
    owned.setText('model User { id Int @id }')
    expect(middleware.provideDefinition?.(owned, position, token, rejected)).toBeUndefined()
    expect(rejected).not.toHaveBeenCalled()
  })

  test('filters diagnostics outside exact committed ownership', async () => {
    const { middleware, ownership, documents } = createSubject()
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')
    documents.set(schema.uri.toString(), schema)
    const next = vi.fn()

    const beforeOwnership = [{ message: 'before ownership' }] as Diagnostic[]
    const owned = [{ message: 'owned' }] as Diagnostic[]
    const stale = [{ message: 'stale' }] as Diagnostic[]

    middleware.handleDiagnostics?.(schema.uri, beforeOwnership, next)
    await ownership.synchronize(schema)
    middleware.handleDiagnostics?.(schema.uri, owned, next)
    schema.setText('model User { id Int @id }')
    middleware.handleDiagnostics?.(schema.uri, stale, next)

    expect(next.mock.calls).toEqual([
      [schema.uri, []],
      [schema.uri, owned],
      [schema.uri, []],
    ])
  })
})
