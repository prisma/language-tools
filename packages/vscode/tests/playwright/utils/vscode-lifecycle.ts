import { rmSync } from 'node:fs'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'

const OUTPUT_LIMIT = 16 * 1024

export interface VSCodeTempDirectories {
  root: string
  userData: string
  extensions: string
}

export interface ProcessExitDetails {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

export async function createVSCodeTempDirectories(
  workerIndex: number,
  retry: number,
  parentDirectory = tmpdir(),
): Promise<VSCodeTempDirectories> {
  const root = await mkdtemp(path.join(parentDirectory, `prisma-vscode-playwright-w${workerIndex}-r${retry}-`))
  const userData = path.join(root, 'user-data')
  const extensions = path.join(root, 'extensions')

  await Promise.all([mkdir(userData), mkdir(extensions)])

  return { root, userData, extensions }
}

export async function cleanupVSCodeTempDirectories(directories: VSCodeTempDirectories): Promise<void> {
  await rm(directories.root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
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
  const status = details.signal ? `signal ${details.signal}` : `code ${details.code ?? 'unknown'}`
  const output = [
    details.stdout && `stdout (last ${OUTPUT_LIMIT} bytes):\n${sanitizeDiagnosticText(details.stdout)}`,
    details.stderr && `stderr (last ${OUTPUT_LIMIT} bytes):\n${sanitizeDiagnosticText(details.stderr)}`,
  ].filter(Boolean)

  return [`VS Code process exited with ${status}.`, ...output].join('\n')
}

export class ProcessDiagnostics {
  private readonly stdout = new BoundedOutput(OUTPUT_LIMIT)
  private readonly stderr = new BoundedOutput(OUTPUT_LIMIT)
  private code: number | null
  private signal: NodeJS.Signals | null
  private readonly stdoutListener = (chunk: Buffer | string) => this.stdout.append(chunk)
  private readonly stderrListener = (chunk: Buffer | string) => this.stderr.append(chunk)
  private readonly exitListener = (code: number | null, signal: NodeJS.Signals | null) => {
    this.code = code
    this.signal = signal
  }

  constructor(private readonly child: ChildProcess) {
    this.code = child.exitCode
    this.signal = child.signalCode
    child.stdout?.on('data', this.stdoutListener)
    child.stderr?.on('data', this.stderrListener)
    child.on('exit', this.exitListener)
  }

  hasExited(): boolean {
    return this.child.exitCode !== null || this.child.signalCode !== null || this.code !== null || this.signal !== null
  }

  format(): string {
    return formatProcessExit({
      code: this.child.exitCode ?? this.code,
      signal: this.child.signalCode ?? this.signal,
      stdout: this.stdout.toString(),
      stderr: this.stderr.toString(),
    })
  }

  dispose(): void {
    this.child.stdout?.off('data', this.stdoutListener)
    this.child.stderr?.off('data', this.stderrListener)
    this.child.off('exit', this.exitListener)
  }
}

class BoundedOutput {
  private value = Buffer.alloc(0)

  constructor(private readonly limit: number) {}

  append(chunk: Buffer | string): void {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    this.value = Buffer.concat([this.value, next]).subarray(-this.limit)
  }

  toString(): string {
    return this.value.toString('utf8').trim()
  }
}

export function sanitizeDiagnosticText(output: string): string {
  return output
    .replace(/([a-z][a-z\d+.-]*:\/\/[^\s:/@]+:)[^\s@/]+@/gi, '$1[REDACTED]@')
    .replace(/\b(authorization|api[-_]?key|password|secret|token)\b(\s*[:=]\s*)([^\s,;]+)/gi, '$1$2[REDACTED]')
}

export function terminateChildProcess(child: ChildProcess): void {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill()
  }
}
