import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { access, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  cleanupVSCodeTempDirectories,
  createVSCodeTempDirectories,
  formatProcessExit,
  getVSCodeTempBase,
  ProcessDiagnostics,
  VSCodeTempDirectoryLease,
} from './vscode-lifecycle'

const temporaryParents: string[] = []

afterEach(async () => {
  await Promise.all(temporaryParents.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('VS Code Playwright lifecycle', () => {
  test('creates collision-free short user data and extensions directories', async () => {
    const parent = await createTemporaryParent()
    const [first, second] = await Promise.all([
      createVSCodeTempDirectories(parent),
      createVSCodeTempDirectories(parent),
    ])

    expect(first.root).not.toBe(second.root)
    expect(path.basename(first.root)).toMatch(/^pv-.{6}$/)
    expect(first.userData).toBe(path.join(first.root, 'u'))
    expect(first.extensions).toBe(path.join(first.root, 'e'))
    await expect(access(first.userData)).resolves.toBeUndefined()
    await expect(access(first.extensions)).resolves.toBeUndefined()
  })

  test('keeps the expected macOS VS Code IPC path comfortably below the socket limit', () => {
    const simulatedRoot = '/tmp/pv-XXXXXX'
    const socketPath = path.posix.join(simulatedRoot, 'u', '1.13-main.sock')

    expect(getVSCodeTempBase('darwin')).toBe('/tmp')
    expect(Buffer.byteLength(simulatedRoot)).toBe(14)
    expect(Buffer.byteLength(socketPath)).toBe(31)
    expect(Buffer.byteLength(socketPath)).toBeLessThan(104)
  })

  test('cleans only the isolated attempt root', async () => {
    const parent = await createTemporaryParent()
    const directories = await createVSCodeTempDirectories(parent)
    const sibling = path.join(parent, 'keep-me')
    await mkdir(sibling)

    await cleanupVSCodeTempDirectories(directories)

    await expect(access(directories.root)).rejects.toThrow()
    await expect(access(sibling)).resolves.toBeUndefined()
  })

  test('configures retries for transient locked-file cleanup', async () => {
    const parent = await createTemporaryParent()
    const directories = await createVSCodeTempDirectories(parent)
    const remove = vi.fn().mockResolvedValue(undefined)

    await cleanupVSCodeTempDirectories(directories, remove)

    expect(remove).toHaveBeenCalledWith(directories.root, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    })
  })

  test('registers process-exit cleanup only for the lifetime of an attempt', async () => {
    const parent = await createTemporaryParent()
    const directories = await createVSCodeTempDirectories(parent)
    const initialListeners = process.listenerCount('exit')
    const lease = new VSCodeTempDirectoryLease(directories)

    expect(process.listenerCount('exit')).toBe(initialListeners + 1)
    await lease.cleanup()

    expect(process.listenerCount('exit')).toBe(initialListeners)
    await expect(access(directories.root)).rejects.toThrow()
  })

  test('formats only structural process exit data', () => {
    expect(formatProcessExit({ code: 9, signal: null })).toBe('exitCode=9 signal=none')
    expect(formatProcessExit({ code: null, signal: 'SIGTERM' })).toBe('exitCode=unknown signal=SIGTERM')
  })

  test('tracks process exit and removes its listener', () => {
    const child = Object.assign(new EventEmitter(), {
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as ChildProcess
    const diagnostics = new ProcessDiagnostics(child)

    child.emit('exit', 7, null)

    expect(diagnostics.hasExited()).toBe(true)
    expect(diagnostics.format()).toBe('exitCode=7 signal=none')
    expect(child.listenerCount('exit')).toBe(1)

    diagnostics.dispose()

    expect(child.listenerCount('exit')).toBe(0)
  })
})

async function createTemporaryParent(): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), 'pv-test-'))
  temporaryParents.push(parent)
  return parent
}
