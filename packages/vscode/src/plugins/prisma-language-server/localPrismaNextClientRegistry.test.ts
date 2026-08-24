import path from 'node:path'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio } from 'node:child_process'
import { describe, expect, test, vi } from 'vitest'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import type { LanguageClientOptions } from 'vscode-languageclient'
import type { ChildProcessInfo, LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import {
  createExtensionHostNodeEnvironment,
  createLocalPrismaNextClientOptions,
  createLocalPrismaNextServerOptions,
  getLocalPrismaNextEntrypoint,
  launchLocalPrismaNextServer,
  LocalPrismaNextClientRegistry,
} from './localPrismaNextClientRegistry'

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

function fakeChildProcess(pid = 123): ChildProcessWithoutNullStreams {
  let killed = false
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    pid,
    kill: vi.fn(() => {
      killed = true
      return true
    }),
  })
  Object.defineProperty(child, 'killed', { get: () => killed })
  return child as unknown as ChildProcessWithoutNullStreams
}

function invokeServerOptions(serverOptions: ServerOptions): Promise<ChildProcessInfo> {
  expect(serverOptions).toBeTypeOf('function')
  return (serverOptions as () => Promise<ChildProcessInfo>)()
}

function matchingWorkspaceFolder(documentUri: Uri): WorkspaceFolder | undefined {
  if (documentUri.toString().includes('workspace-a')) return rootA
  if (documentUri.toString().includes('workspace-b')) return rootB
  return undefined
}

describe('LocalPrismaNextClientRegistry', () => {
  test('launches the exact CLI argv with extension-host Node and root-local streams', async () => {
    const entrypoint = getLocalPrismaNextEntrypoint(rootA)
    const child = fakeChildProcess()
    const spawnProcess = vi.fn((_executable: string, _args: string[], _options: SpawnOptionsWithoutStdio) => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    })
    const handleProcessError = vi.fn()
    const serverOptions = createLocalPrismaNextServerOptions(rootA, entrypoint, {
      executable: '/extension-host',
      environment: { EXISTING: 'preserved' },
      spawnProcess,
      handleProcessError,
    })

    const result = await invokeServerOptions(serverOptions)

    expect(entrypoint).toBe(path.join('/workspace-a', 'node_modules', 'prisma', 'dist', 'prisma.js'))
    expect(spawnProcess).toHaveBeenCalledOnce()
    expect(spawnProcess).toHaveBeenCalledWith('/extension-host', [entrypoint, 'lsp'], {
      cwd: '/workspace-a',
      env: {
        EXISTING: 'preserved',
        ELECTRON_RUN_AS_NODE: '1',
        ELECTRON_NO_ASAR: '1',
      },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    expect(result).toEqual({ process: child, detached: false })
    expect(result.process.stdin).toBe(child.stdin)
    expect(result.process.stdout).toBe(child.stdout)
    expect(result.process.stderr).toBe(child.stderr)

    const processError = new Error('process error')
    child.emit('error', processError)
    expect(handleProcessError).toHaveBeenCalledWith(processError)
  })

  test('preserves the environment while enabling Electron extension hosts to run as Node', () => {
    expect(createExtensionHostNodeEnvironment({ EXISTING: 'preserved', ELECTRON_RUN_AS_NODE: '0' })).toEqual({
      EXISTING: 'preserved',
      ELECTRON_RUN_AS_NODE: '1',
      ELECTRON_NO_ASAR: '1',
    })
  })

  test('rejects early spawn errors and releases startup resources', async () => {
    const child = fakeChildProcess()
    const startError = new Error('spawn failed')
    const spawnProcess = vi.fn(() => {
      queueMicrotask(() => child.emit('error', startError))
      return child
    })

    await expect(
      launchLocalPrismaNextServer({
        executable: '/extension-host',
        entrypoint: '/workspace-a/node_modules/prisma/dist/prisma.js',
        cwd: '/workspace-a',
        environment: {},
        spawnProcess,
      }),
    ).rejects.toBe(startError)

    expect(child.killed).toBe(true)
    expect(child.stdin.destroyed).toBe(true)
    expect(child.stdout.destroyed).toBe(true)
    expect(child.stderr.destroyed).toBe(true)
    expect(child.listenerCount('error')).toBe(0)
    expect(child.listenerCount('spawn')).toBe(0)
  })

  test('keeps local document synchronization disabled until owner middleware is attached', () => {
    expect(createLocalPrismaNextClientOptions(rootA)).toEqual({ documentSelector: [], workspaceFolder: rootA })
  })

  test('publishes pending startup per root and starts independent clients', async () => {
    const discovery = deferred<boolean>()
    const entrypointExists = vi.fn().mockReturnValue(discovery.promise)
    const clients = new Map<string, LanguageClient>()
    const spawnProcess = vi.fn((_executable: string, _args: string[], _options: SpawnOptionsWithoutStdio) => {
      const child = fakeChildProcess()
      queueMicrotask(() => child.emit('spawn'))
      return child
    })
    const createClient = vi.fn(
      (_id: string, name: string, serverOptions: ServerOptions, clientOptions: LanguageClientOptions) => {
        const client = fakeClient(
          name,
          vi.fn(() => invokeServerOptions(serverOptions).then(() => undefined)),
        )
        clients.set(clientOptions.workspaceFolder?.uri.toString() ?? '', client)
        return client
      },
    )
    const registerDisposable = vi.fn()
    const registry = new LocalPrismaNextClientRegistry({
      workspace: { isTrusted: true, getWorkspaceFolder: matchingWorkspaceFolder },
      entrypointExists,
      createClient,
      registerDisposable,
      launcher: {
        executable: '/extension-host',
        environment: {},
        spawnProcess,
      },
    })

    const firstRootA = registry.ensureClientForDocument(document('file:///workspace-a/first.prisma'))
    const secondRootA = registry.ensureClientForDocument(document('file:///workspace-a/second.prisma'))
    const firstRootB = registry.ensureClientForDocument(document('file:///workspace-b/schema.prisma'))

    await vi.waitFor(() => expect(entrypointExists).toHaveBeenCalledTimes(2))
    expect(createClient).not.toHaveBeenCalled()
    discovery.resolve(true)

    const results = await Promise.all([firstRootA, secondRootA, firstRootB])

    expect(results).toEqual([
      clients.get(rootA.uri.toString()),
      clients.get(rootA.uri.toString()),
      clients.get(rootB.uri.toString()),
    ])
    expect(createClient).toHaveBeenCalledTimes(2)
    expect(registerDisposable).toHaveBeenCalledTimes(2)
    expect(spawnProcess).toHaveBeenCalledTimes(2)
    expect(
      spawnProcess.mock.calls.map(([executable, args, options]) => ({ executable, args, cwd: options.cwd })),
    ).toEqual([
      {
        executable: '/extension-host',
        args: [path.join('/workspace-a', 'node_modules', 'prisma', 'dist', 'prisma.js'), 'lsp'],
        cwd: '/workspace-a',
      },
      {
        executable: '/extension-host',
        args: [path.join('/workspace-b', 'node_modules', 'prisma', 'dist', 'prisma.js'), 'lsp'],
        cwd: '/workspace-b',
      },
    ])
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
