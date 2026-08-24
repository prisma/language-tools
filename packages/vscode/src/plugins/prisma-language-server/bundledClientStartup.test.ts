import { describe, expect, test, vi } from 'vitest'
import { BundledClientStartup } from './bundledClientStartup'

interface TestDocument {
  readonly uri: string
  text: string
}

function deferred(): { promise: Promise<void>; resolve(): void; reject(error: unknown): void } {
  let resolvePromise: (() => void) | undefined
  let rejectPromise: ((error: unknown) => void) | undefined
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return {
    promise,
    resolve: () => resolvePromise?.(),
    reject: (error) => rejectPromise?.(error),
  }
}

function createSubject() {
  const currentDocuments = new Map<string, TestDocument>()
  const synchronized: { document: TestDocument; text: string }[] = []
  const owners = new Map<TestDocument, 'bundled'>()
  const logError = vi.fn()
  const startup = new BundledClientStartup<TestDocument>({
    isCurrent: (document) => currentDocuments.get(document.uri) === document,
    synchronize: (document) => {
      synchronized.push({ document, text: document.text })
      owners.set(document, 'bundled')
      return Promise.resolve()
    },
    logError,
  })
  return { startup, currentDocuments, synchronized, owners, logError }
}

describe('BundledClientStartup', () => {
  test('keeps readiness failure stable until a replacement is installed', async () => {
    const subject = createSubject()
    const readiness = deferred()
    const document = { uri: 'file:///schema.prisma', text: 'model A {}' }
    subject.currentDocuments.set(document.uri, document)

    subject.startup.start(() => readiness.promise)
    subject.startup.schedule(document)
    readiness.reject(new Error('startup failed'))

    await vi.waitFor(() => expect(subject.startup.status).toBe('failed'))
    expect(subject.synchronized).toEqual([])
    expect(subject.logError).toHaveBeenCalledOnce()

    subject.startup.schedule(document)
    await Promise.resolve()
    expect(subject.synchronized).toEqual([])
    expect(subject.logError).toHaveBeenCalledOnce()

    subject.startup.replace(Promise.resolve())
    subject.startup.schedule(document)
    await vi.waitFor(() => expect(subject.synchronized).toHaveLength(1))
    expect(subject.startup.status).toBe('ready')
  })

  test('drops a closed stale instance and synchronizes one reopened replacement', async () => {
    const subject = createSubject()
    const readiness = deferred()
    const stale = { uri: 'file:///schema.prisma', text: 'model Stale {}' }
    const replacement = { uri: stale.uri, text: 'model Current {}' }
    subject.currentDocuments.set(stale.uri, stale)

    subject.startup.start(() => readiness.promise)
    subject.startup.schedule(stale)
    subject.currentDocuments.delete(stale.uri)
    subject.currentDocuments.set(replacement.uri, replacement)
    subject.startup.schedule(replacement)
    readiness.resolve()

    await vi.waitFor(() => expect(subject.synchronized).toHaveLength(1))
    expect(subject.synchronized).toEqual([{ document: replacement, text: replacement.text }])
    expect(subject.owners.get(stale)).toBeUndefined()
    expect(subject.owners.get(replacement)).toBe('bundled')
  })

  test('coalesces startup and pending events while synchronizing the latest text', async () => {
    const subject = createSubject()
    const readiness = deferred()
    const startClient = vi.fn(() => readiness.promise)
    const document = { uri: 'file:///schema.prisma', text: 'model Initial {}' }
    subject.currentDocuments.set(document.uri, document)

    subject.startup.start(startClient)
    subject.startup.start(startClient)
    subject.startup.schedule(document)
    document.text = 'model Changed {}'
    subject.startup.schedule(document)
    document.text = 'model Latest {}'
    subject.startup.schedule(document)
    readiness.resolve()

    await vi.waitFor(() => expect(subject.synchronized).toHaveLength(1))
    expect(startClient).toHaveBeenCalledOnce()
    expect(subject.synchronized[0]).toEqual({ document, text: 'model Latest {}' })
  })

  test('replacement invalidates old readiness and disposal absorbs later rejection', async () => {
    const subject = createSubject()
    const oldReadiness = deferred()
    const replacementReadiness = deferred()
    const document = { uri: 'file:///schema.prisma', text: 'model Current {}' }
    subject.currentDocuments.set(document.uri, document)

    subject.startup.start(() => oldReadiness.promise)
    subject.startup.schedule(document)
    subject.startup.replace(replacementReadiness.promise)
    subject.startup.schedule(document)
    oldReadiness.resolve()
    replacementReadiness.resolve()

    await vi.waitFor(() => expect(subject.synchronized).toHaveLength(1))
    expect(subject.startup.status).toBe('ready')

    const deactivationReadiness = deferred()
    subject.startup.replace(deactivationReadiness.promise)
    subject.startup.schedule(document)
    subject.startup.dispose()
    deactivationReadiness.reject(new Error('stopped during startup'))
    await Promise.resolve()

    expect(subject.startup.status).toBe('disposed')
    expect(subject.synchronized).toHaveLength(1)
    expect(subject.logError).not.toHaveBeenCalled()
  })
})
