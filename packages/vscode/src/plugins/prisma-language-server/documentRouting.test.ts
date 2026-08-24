import { describe, expect, test, vi } from 'vitest'
import type { TextDocument, Uri, WorkspaceFolder } from 'vscode'
import { DocumentOwnershipCoordinator } from './documentOwnership'
import {
  createPrepareDocumentRoutingCommit,
  type BundledDocumentSynchronization,
  type DocumentRoutingEvent,
  type LocalDocumentSynchronization,
} from './documentRouting'

const rootA = workspaceFolder('file:///workspace-a')
const rootB = workspaceFolder('file:///workspace-b')

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
    getText: () => currentText,
    setText: (value) => {
      currentText = value
    },
  } as TextDocument & { setText(value: string): void }
}

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: () => resolvePromise?.() }
}

function createSubject(options: { localClose?: Promise<void>; localStartup?: Promise<void> } = {}) {
  const active = new Set<string>()
  const closedDocumentUris = new Set<string>()
  const protocolCloses: { owner: 'bundled' | 'local'; uri: string }[] = []
  const opens: { owner: string; uri: string; text: string }[] = []
  const activeOwnerCountsAfterOpen: number[] = []
  const events: DocumentRoutingEvent[] = []
  const clearBundledDiagnostics = vi.fn()
  const clearLocalDiagnostics = vi.fn()
  const bundled: BundledDocumentSynchronization = {
    openDocument: (schema) => {
      active.add(`bundled:${schema.uri.toString()}`)
      activeOwnerCountsAfterOpen.push([...active].filter((key) => key.endsWith(`:${schema.uri.toString()}`)).length)
      opens.push({ owner: 'bundled', uri: schema.uri.toString(), text: schema.getText() })
    },
    closeDocument: (schema) => {
      if (active.delete(`bundled:${schema.uri.toString()}`)) {
        protocolCloses.push({ owner: 'bundled', uri: schema.uri.toString() })
      }
    },
    clearDiagnostics: clearBundledDiagnostics,
  }
  const ensureClientForDocument = vi.fn(async () => {
    await options.localStartup
    return {}
  })
  const closeLocalDocument = vi.fn((root: string, schema: TextDocument) =>
    (options.localClose ?? Promise.resolve()).then(() => {
      if (active.delete(`local:${root}:${schema.uri.toString()}`)) {
        protocolCloses.push({ owner: 'local', uri: schema.uri.toString() })
      }
    }),
  )
  const local: LocalDocumentSynchronization = {
    ensureClientForDocument,
    openDocument: (root, schema) => {
      active.add(`local:${root}:${schema.uri.toString()}`)
      activeOwnerCountsAfterOpen.push([...active].filter((key) => key.endsWith(`:${schema.uri.toString()}`)).length)
      opens.push({ owner: root, uri: schema.uri.toString(), text: schema.getText() })
      return Promise.resolve(true)
    },
    closeDocument: closeLocalDocument,
    clearDiagnostics: clearLocalDiagnostics,
  }
  const ownership: DocumentOwnershipCoordinator = new DocumentOwnershipCoordinator({
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
    prepareOwner: createPrepareDocumentRoutingCommit({
      getOwnership: (): DocumentOwnershipCoordinator => ownership,
      isDocumentOpen: (schema) => !closedDocumentUris.has(schema.uri.toString()),
      getBundled: () => bundled,
      getLocal: () => local,
      observer: (event) => events.push(event),
    }),
  })
  const closeEditorDocument = (schema: TextDocument): void => {
    const documentUri = schema.uri.toString()
    closedDocumentUris.add(documentUri)
    if (active.delete(`bundled:${documentUri}`)) {
      protocolCloses.push({ owner: 'bundled', uri: documentUri })
      clearBundledDiagnostics(schema.uri)
    }
    const root = documentUri.includes('workspace-a') ? rootA : rootB
    if (active.delete(`local:${root.uri.toString()}:${documentUri}`)) {
      protocolCloses.push({ owner: 'local', uri: documentUri })
      clearLocalDiagnostics(root.uri.toString(), schema.uri)
    }
  }

  return {
    ownership,
    bundled,
    local,
    ensureClientForDocument,
    closeLocalDocument,
    closeEditorDocument,
    protocolCloses,
    clearBundledDiagnostics,
    clearLocalDiagnostics,
    active,
    activeOwnerCountsAfterOpen,
    opens,
    events,
  }
}

describe('document routing commits', () => {
  test('transfers both directions with close-clear-open ordering and complete current text', async () => {
    const subject = createSubject()
    const schema = document('file:///workspace-a/schema.prisma', 'model User { id Int @id }')
    await subject.ownership.synchronize(schema)
    subject.events.length = 0
    subject.opens.length = 0

    schema.setText('// use prisma-next\nmodel User { id Int @id name String }')
    await subject.ownership.synchronize(schema)

    expect(subject.events.map((event) => event.type)).toEqual(['closed', 'diagnosticsCleared', 'opened'])
    expect(subject.opens).toEqual([
      {
        owner: rootA.uri.toString(),
        uri: schema.uri.toString(),
        text: schema.getText(),
      },
    ])
    expect(subject.active).toEqual(new Set([`local:${rootA.uri.toString()}:${schema.uri.toString()}`]))
    expect(subject.activeOwnerCountsAfterOpen).toEqual([1, 1])
    expect(subject.clearBundledDiagnostics).toHaveBeenCalledWith(schema.uri)

    subject.events.length = 0
    subject.opens.length = 0
    schema.setText('model User { id Int @id email String }')
    await subject.ownership.synchronize(schema)

    expect(subject.events.map((event) => event.type)).toEqual(['closed', 'diagnosticsCleared', 'opened'])
    expect(subject.opens).toEqual([{ owner: 'bundled', uri: schema.uri.toString(), text: schema.getText() }])
    expect(subject.active).toEqual(new Set([`bundled:${schema.uri.toString()}`]))
    expect(subject.activeOwnerCountsAfterOpen).toEqual([1, 1, 1])
    expect(subject.clearLocalDiagnostics).toHaveBeenCalledWith(rootA.uri.toString(), schema.uri)
  })

  test('awaits the prior close before clearing diagnostics or opening the next owner', async () => {
    const close = deferred()
    const subject = createSubject({ localClose: close.promise })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next\nmodel User { id Int @id }')
    await subject.ownership.synchronize(schema)
    subject.events.length = 0

    schema.setText('model User { id Int @id }')
    const transfer = subject.ownership.synchronize(schema)
    await vi.waitFor(() => expect(subject.active).toContain(`local:${rootA.uri.toString()}:${schema.uri.toString()}`))

    expect(subject.events).toEqual([])
    expect(subject.clearLocalDiagnostics).not.toHaveBeenCalled()
    expect(subject.opens.filter(({ owner }) => owner === 'bundled')).toHaveLength(0)

    close.resolve()
    await transfer

    expect(subject.events.map((event) => event.type)).toEqual(['closed', 'diagnosticsCleared', 'opened'])
  })

  test('does not reopen locally when the editor closes during local startup', async () => {
    const startup = deferred()
    const subject = createSubject({ localStartup: startup.promise })
    const schema = document('file:///workspace-a/schema.prisma', 'model User { id Int @id }')
    await subject.ownership.synchronize(schema)
    subject.opens.length = 0

    schema.setText('// use prisma-next\nmodel User { id Int @id }')
    const transfer = subject.ownership.synchronize(schema)
    await vi.waitFor(() => expect(subject.ensureClientForDocument).toHaveBeenCalledOnce())

    subject.closeEditorDocument(schema)
    const closing = subject.ownership.close(schema)
    startup.resolve()
    await Promise.all([transfer, closing])

    expect(subject.opens).toEqual([])
    expect(subject.active).toEqual(new Set())
    expect(subject.protocolCloses).toEqual([{ owner: 'bundled', uri: schema.uri.toString() }])
    expect(subject.clearBundledDiagnostics).toHaveBeenCalledWith(schema.uri)
    expect(subject.clearLocalDiagnostics).toHaveBeenCalledWith(rootA.uri.toString(), schema.uri)
    expect(subject.ownership.getOwner(schema.uri)).toEqual({ kind: 'unowned' })
  })

  test('does not reopen bundled when the editor closes during a delayed prior-owner close', async () => {
    const close = deferred()
    const subject = createSubject({ localClose: close.promise })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next\nmodel User { id Int @id }')
    await subject.ownership.synchronize(schema)
    subject.opens.length = 0

    schema.setText('model User { id Int @id }')
    const transfer = subject.ownership.synchronize(schema)
    await vi.waitFor(() => expect(subject.closeLocalDocument).toHaveBeenCalledOnce())

    subject.closeEditorDocument(schema)
    const closing = subject.ownership.close(schema)
    close.resolve()
    await Promise.all([transfer, closing])

    expect(subject.opens).toEqual([])
    expect(subject.active).toEqual(new Set())
    expect(subject.protocolCloses).toEqual([{ owner: 'local', uri: schema.uri.toString() }])
    expect(subject.clearLocalDiagnostics).toHaveBeenCalledWith(rootA.uri.toString(), schema.uri)
    expect(subject.clearBundledDiagnostics).toHaveBeenCalledWith(schema.uri)
    expect(subject.ownership.getOwner(schema.uri)).toEqual({ kind: 'unowned' })
  })

  test('does not open a stale local candidate when text changes during startup', async () => {
    const startup = deferred()
    const subject = createSubject({ localStartup: startup.promise })
    const schema = document('file:///workspace-a/schema.prisma', 'model User { id Int @id }')
    await subject.ownership.synchronize(schema)
    subject.opens.length = 0

    schema.setText('// use prisma-next\nmodel User { id Int @id }')
    const staleLocal = subject.ownership.synchronize(schema)
    await vi.waitFor(() => expect(subject.active.size).toBe(0))
    schema.setText('model User { id Int @id current String }')
    const survivingBundled = subject.ownership.synchronize(schema)
    startup.resolve()
    await Promise.all([staleLocal, survivingBundled])

    expect(subject.opens).toEqual([{ owner: 'bundled', uri: schema.uri.toString(), text: schema.getText() }])
    expect(subject.ownership.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
    expect(subject.active).toEqual(new Set([`bundled:${schema.uri.toString()}`]))
  })

  test('repeated synchronization is idempotent for unchanged ownership', async () => {
    const subject = createSubject()
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next\nmodel User { id Int @id }')

    await subject.ownership.synchronize(schema)
    subject.events.length = 0
    subject.opens.length = 0
    await Promise.all([
      subject.ownership.synchronize(schema),
      subject.ownership.synchronize(schema),
      subject.ownership.synchronize(schema),
    ])

    expect(subject.events).toEqual([])
    expect(subject.opens).toEqual([])
    expect(subject.active).toEqual(new Set([`local:${rootA.uri.toString()}:${schema.uri.toString()}`]))
  })

  test('routes same-root schema files independently', async () => {
    const subject = createSubject()
    const marked = document('file:///workspace-a/marked.prisma', '// use prisma-next\nmodel A { id Int @id }')
    const unmarked = document('file:///workspace-a/unmarked.prisma', 'model B { id Int @id }')

    await Promise.all([subject.ownership.synchronize(marked), subject.ownership.synchronize(unmarked)])
    unmarked.setText('// use prisma-next\nmodel B { id Int @id name String }')
    await subject.ownership.synchronize(unmarked)

    expect(subject.active).toEqual(
      new Set([
        `local:${rootA.uri.toString()}:${marked.uri.toString()}`,
        `local:${rootA.uri.toString()}:${unmarked.uri.toString()}`,
      ]),
    )
    expect(subject.opens.filter(({ uri }) => uri === marked.uri.toString())).toHaveLength(1)
    expect(subject.opens.filter(({ uri }) => uri === unmarked.uri.toString())).toHaveLength(2)
    expect(subject.clearBundledDiagnostics).toHaveBeenCalledWith(unmarked.uri)
  })

  test('keeps local ownership isolated per document and workspace root', async () => {
    const subject = createSubject()
    const schemaA = document('file:///workspace-a/schema.prisma', '// use prisma-next\nmodel A { id Int @id }')
    const schemaB = document('file:///workspace-b/schema.prisma', '// use prisma-next\nmodel B { id Int @id }')

    await Promise.all([subject.ownership.synchronize(schemaA), subject.ownership.synchronize(schemaB)])

    expect(subject.opens.map(({ owner, uri }) => ({ owner, uri }))).toEqual([
      { owner: rootA.uri.toString(), uri: schemaA.uri.toString() },
      { owner: rootB.uri.toString(), uri: schemaB.uri.toString() },
    ])
  })
})
