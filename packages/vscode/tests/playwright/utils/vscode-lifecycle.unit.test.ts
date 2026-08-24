import type { ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { access, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, test } from 'vitest'
import {
  cleanupVSCodeTempDirectories,
  createVSCodeTempDirectories,
  formatProcessExit,
  ProcessDiagnostics,
  VSCodeTempDirectoryLease,
} from './vscode-lifecycle'

const temporaryParents: string[] = []

afterEach(async () => {
  await Promise.all(temporaryParents.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('VS Code Playwright lifecycle', () => {
  test('creates collision-free user data and extensions directories per attempt', async () => {
    const parent = await createTemporaryParent()
    const [first, second] = await Promise.all([
      createVSCodeTempDirectories(2, 1, parent),
      createVSCodeTempDirectories(2, 1, parent),
    ])

    expect(first.root).not.toBe(second.root)
    expect(first.userData).toBe(path.join(first.root, 'user-data'))
    expect(first.extensions).toBe(path.join(first.root, 'extensions'))
    await expect(access(first.userData)).resolves.toBeUndefined()
    await expect(access(first.extensions)).resolves.toBeUndefined()
  })

  test('cleans only the isolated attempt root', async () => {
    const parent = await createTemporaryParent()
    const directories = await createVSCodeTempDirectories(0, 0, parent)
    const sibling = path.join(parent, 'keep-me')
    await mkdir(sibling)

    await cleanupVSCodeTempDirectories(directories)

    await expect(access(directories.root)).rejects.toThrow()
    await expect(access(sibling)).resolves.toBeUndefined()
  })

  test('registers process-exit cleanup only for the lifetime of an attempt', async () => {
    const parent = await createTemporaryParent()
    const directories = await createVSCodeTempDirectories(0, 0, parent)
    const initialListeners = process.listenerCount('exit')
    const lease = new VSCodeTempDirectoryLease(directories)

    expect(process.listenerCount('exit')).toBe(initialListeners + 1)
    await lease.cleanup()

    expect(process.listenerCount('exit')).toBe(initialListeners)
    await expect(access(directories.root)).rejects.toThrow()
  })

  test('formats exit code, signal, bounded output labels, and redacts secrets', () => {
    const byCode = formatProcessExit({
      code: 9,
      signal: null,
      stdout: 'server ready',
      stderr: 'DATABASE_URL=postgres://user:password@example.test/db token=do-not-print',
    })
    const bySignal = formatProcessExit({ code: null, signal: 'SIGTERM', stdout: '', stderr: '' })

    expect(byCode).toContain('exited with code 9')
    expect(byCode).toContain('stdout (last 16384 bytes):\nserver ready')
    expect(byCode).toContain('postgres://user:[REDACTED]@example.test/db')
    expect(byCode).toContain('token=[REDACTED]')
    expect(byCode).not.toContain('do-not-print')
    expect(bySignal).toBe('VS Code process exited with signal SIGTERM.')
  })

  test('bounds child output and removes all diagnostic listeners', () => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stderr,
      exitCode: null,
      signalCode: null,
      kill: () => true,
    }) as unknown as ChildProcess
    const diagnostics = new ProcessDiagnostics(child)

    stdout.write('discarded-output'.repeat(2000))
    stdout.write('final-output')
    child.emit('exit', 7, null)

    const formatted = diagnostics.format()
    expect(formatted).toContain('exited with code 7')
    expect(formatted).toContain('final-output')
    expect(Buffer.byteLength(formatted)).toBeLessThan(17 * 1024)
    expect(stdout.listenerCount('data')).toBe(1)
    expect(stderr.listenerCount('data')).toBe(1)
    expect(child.listenerCount('exit')).toBe(1)

    diagnostics.dispose()

    expect(stdout.listenerCount('data')).toBe(0)
    expect(stderr.listenerCount('data')).toBe(0)
    expect(child.listenerCount('exit')).toBe(0)
  })
})

async function createTemporaryParent(): Promise<string> {
  const parent = await mkdtemp(path.join(tmpdir(), 'prisma-vscode-lifecycle-test-'))
  temporaryParents.push(parent)
  return parent
}
