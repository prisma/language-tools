import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import type { LanguageClientOptions } from 'vscode-languageclient'
import type { LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import {
  createLocalPrismaNextClientOptions,
  createLocalPrismaNextServerOptions,
  getLocalPrismaNextEntrypoint,
  LocalPrismaNextClientRegistry,
} from './localPrismaNextClientRegistry'

vi.mock('vscode-languageclient/node', () => ({
  TransportKind: { stdio: 0 },
}))

const rootA = workspaceFolder('file:///workspace-a', '/workspace-a', 'workspace-a')
const rootB = workspaceFolder('file:///workspace-b', '/workspace-b', 'workspace-b')

function uri(value: string, fsPath = value): Uri {
  return {
    scheme: value.slice(0, value.indexOf(':')),
    fsPath,
    toString: () => value,
  } as Uri
}

function workspaceFolder(value: string, fsPath: string, name: string): WorkspaceFolder {
  return { uri: uri(value, fsPath), name } as WorkspaceFolder
}

function document(value: string): TextDocument {
  return {
    uri: uri(value),
    languageId: 'prisma',
    getText: () => '// use prisma-next',
  } as TextDocument
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  }
}

function fakeClient(name: string, onReady = vi.fn().mockResolvedValue(undefined)): LanguageClient {
  return {
    name,
    start: vi.fn().mockReturnValue({ dispose: vi.fn() } satisfies Disposable),
    onReady,
  } as unknown as LanguageClient
}

function matchingWorkspaceFolder(documentUri: Uri): WorkspaceFolder | undefined {
  if (documentUri.toString().includes('workspace-a')) return rootA
  if (documentUri.toString().includes('workspace-b')) return rootB
  return undefined
}

describe('LocalPrismaNextClientRegistry', () => {
  test('builds exact module options for the matching workspace root', () => {
    const entrypoint = getLocalPrismaNextEntrypoint(rootA)
    const serverOptions = createLocalPrismaNextServerOptions(rootA)
    const clientOptions = createLocalPrismaNextClientOptions(rootA)

    expect(entrypoint).toBe(path.join('/workspace-a', 'node_modules', 'prisma', 'dist', 'prisma.js'))
    expect(serverOptions).toEqual({
      module: entrypoint,
      args: ['lsp'],
      transport: 0,
      options: { cwd: '/workspace-a' },
    })
    expect(serverOptions).not.toHaveProperty('runtime')
    expect(clientOptions).toEqual({ documentSelector: [], workspaceFolder: rootA })
  })

  test('publishes pending startup per root and starts independent clients', async () => {
    const discovery = deferred<boolean>()
    const entrypointExists = vi.fn().mockReturnValue(discovery.promise)
    const clients = new Map([
      [rootA.uri.toString(), fakeClient('root-a')],
      [rootB.uri.toString(), fakeClient('root-b')],
    ])
    const createClient = vi.fn(
      (_id: string, _name: string, _serverOptions: ServerOptions, clientOptions: LanguageClientOptions) =>
        clients.get(clientOptions.workspaceFolder?.uri.toString() ?? '') as LanguageClient,
    )
    const registerDisposable = vi.fn()
    const registry = new LocalPrismaNextClientRegistry({
      workspace: { isTrusted: true, getWorkspaceFolder: matchingWorkspaceFolder },
      entrypointExists,
      createClient,
      registerDisposable,
    })

    const firstRootA = registry.ensureClientForDocument(document('file:///workspace-a/first.prisma'))
    const secondRootA = registry.ensureClientForDocument(document('file:///workspace-a/second.prisma'))
    const firstRootB = registry.ensureClientForDocument(document('file:///workspace-b/schema.prisma'))

    await vi.waitFor(() => expect(entrypointExists).toHaveBeenCalledTimes(2))
    expect(createClient).not.toHaveBeenCalled()
    discovery.resolve(true)

    await expect(Promise.all([firstRootA, secondRootA, firstRootB])).resolves.toEqual([
      clients.get(rootA.uri.toString()),
      clients.get(rootA.uri.toString()),
      clients.get(rootB.uri.toString()),
    ])
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(registerDisposable).toHaveBeenCalledTimes(2)
    expect(registry.getTestState()).toEqual({
      startedWorkspaceFolderUris: [rootA.uri.toString(), rootB.uri.toString()],
    })
  })

  test('does no discovery until an eligible document requests a client', async () => {
    const entrypointExists = vi.fn().mockResolvedValue(false)
    const createClient = vi.fn()
    const handleStartError = vi.fn()
    const registry = new LocalPrismaNextClientRegistry({
      workspace: { isTrusted: true, getWorkspaceFolder: matchingWorkspaceFolder },
      entrypointExists,
      createClient,
      registerDisposable: vi.fn(),
      handleStartError,
    })

    expect(entrypointExists).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()

    const schema = document('file:///workspace-a/schema.prisma')
    await expect(registry.ensureClientForDocument(schema)).resolves.toBeUndefined()
    await expect(registry.ensureClientForDocument(schema)).resolves.toBeUndefined()

    expect(entrypointExists).toHaveBeenCalledOnce()
    expect(entrypointExists).toHaveBeenCalledWith(
      path.join('/workspace-a', 'node_modules', 'prisma', 'dist', 'prisma.js'),
    )
    expect(createClient).not.toHaveBeenCalled()
    expect(handleStartError).not.toHaveBeenCalled()
  })

  test.each([
    { name: 'untrusted workspace', trusted: false, documentUri: 'file:///workspace-a/schema.prisma' },
    { name: 'non-file document', trusted: true, documentUri: 'untitled:Untitled-1' },
    { name: 'unmatched workspace', trusted: true, documentUri: 'file:///outside/schema.prisma' },
  ])('does not discover or start for an $name', async ({ trusted, documentUri }) => {
    const entrypointExists = vi.fn().mockResolvedValue(true)
    const createClient = vi.fn()
    const registry = new LocalPrismaNextClientRegistry({
      workspace: { isTrusted: trusted, getWorkspaceFolder: matchingWorkspaceFolder },
      entrypointExists,
      createClient,
      registerDisposable: vi.fn(),
    })

    await expect(registry.ensureClientForDocument(document(documentUri))).resolves.toBeUndefined()

    expect(entrypointExists).not.toHaveBeenCalled()
    expect(createClient).not.toHaveBeenCalled()
  })

  test('reports a real startup failure once without retrying automatically', async () => {
    const startError = new Error('startup failed')
    const client = fakeClient('root-a', vi.fn().mockRejectedValue(startError))
    const handleStartError = vi.fn()
    const createClient = vi.fn().mockReturnValue(client)
    const registry = new LocalPrismaNextClientRegistry({
      workspace: { isTrusted: true, getWorkspaceFolder: matchingWorkspaceFolder },
      entrypointExists: vi.fn().mockResolvedValue(true),
      createClient,
      registerDisposable: vi.fn(),
      handleStartError,
    })
    const schema = document('file:///workspace-a/schema.prisma')

    await expect(registry.ensureClientForDocument(schema)).resolves.toBeUndefined()
    await expect(registry.ensureClientForDocument(schema)).resolves.toBeUndefined()

    expect(createClient).toHaveBeenCalledOnce()
    expect(handleStartError).toHaveBeenCalledOnce()
    expect(handleStartError).toHaveBeenCalledWith(rootA, startError)
    expect(registry.getTestState()).toEqual({ startedWorkspaceFolderUris: [] })
  })
})
