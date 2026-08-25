import type { ChildProcess } from 'node:child_process'
import { rmSync } from 'node:fs'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export interface VSCodeTempDirectories {
  root: string
  userData: string
  extensions: string
}

export interface ProcessExitDetails {
  code: number | null
  signal: NodeJS.Signals | null
}

export function getVSCodeTempBase(platform: NodeJS.Platform = process.platform): string {
  return platform === 'darwin' ? '/tmp' : tmpdir()
}

export async function createVSCodeTempDirectories(
  parentDirectory = getVSCodeTempBase(),
): Promise<VSCodeTempDirectories> {
  const root = await mkdtemp(path.join(parentDirectory, 'pv-'))
  const userData = path.join(root, 'u')
  const extensions = path.join(root, 'e')

  await Promise.all([mkdir(userData), mkdir(extensions)])

  return { root, userData, extensions }
}

type RemoveDirectory = (
  directory: string,
  options: { recursive: true; force: true; maxRetries: number; retryDelay: number },
) => Promise<void>

export async function cleanupVSCodeTempDirectories(
  directories: VSCodeTempDirectories,
  removeDirectory: RemoveDirectory = rm,
): Promise<void> {
  await removeDirectory(directories.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

export class VSCodeTempDirectoryLease {
  private cleaned = false
  private readonly cleanupOnProcessExit = () => {
    try {
      rmSync(this.directories.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } catch {
      // The process is already exiting; normal teardown reports cleanup failures when it can.
    }
  }

  constructor(readonly directories: VSCodeTempDirectories) {
    process.once('exit', this.cleanupOnProcessExit)
  }

  async cleanup(): Promise<void> {
    if (this.cleaned) {
      return
    }

    await cleanupVSCodeTempDirectories(this.directories)
    this.cleaned = true
    process.off('exit', this.cleanupOnProcessExit)
  }
}

export function formatProcessExit(details: ProcessExitDetails): string {
  return `exitCode=${details.code ?? 'unknown'} signal=${details.signal ?? 'none'}`
}

export class ProcessDiagnostics {
  private code: number | null
  private signal: NodeJS.Signals | null
  private readonly exitListener = (code: number | null, signal: NodeJS.Signals | null) => {
    this.code = code
    this.signal = signal
  }

  constructor(private readonly child: ChildProcess) {
    this.code = child.exitCode
    this.signal = child.signalCode
    child.on('exit', this.exitListener)
  }

  hasExited(): boolean {
    return this.child.exitCode !== null || this.child.signalCode !== null || this.code !== null || this.signal !== null
  }

  format(): string {
    return formatProcessExit({
      code: this.child.exitCode ?? this.code,
      signal: this.child.signalCode ?? this.signal,
    })
  }

  dispose(): void {
    this.child.off('exit', this.exitListener)
  }
}

export function terminateChildProcess(child: ChildProcess): void {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill()
  }
}
