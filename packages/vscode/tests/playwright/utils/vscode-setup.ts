import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import {
  createVSCodeTempDirectories,
  ProcessDiagnostics,
  terminateChildProcess,
  VSCodeTempDirectoryLease,
} from './vscode-lifecycle'

export interface VSCodeSetupOptions {
  rootPath: string
  testWorkspace: string
  disableExtensions?: boolean
  timeout?: number
  workerIndex: number
  retry: number
}

export interface VSCodeTestSession {
  page: Page
  close(): Promise<void>
}

export async function setupVSCode(options: VSCodeSetupOptions): Promise<VSCodeTestSession> {
  const { rootPath, testWorkspace, disableExtensions = true, timeout = 30000, workerIndex, retry } = options
  const directories = await createVSCodeTempDirectories()
  const directoryLease = new VSCodeTempDirectoryLease(directories)
  const attemptId = `w${workerIndex}-r${retry}-${randomUUID()}`
  let electronApp: ElectronApplication | undefined
  let diagnostics: ProcessDiagnostics | undefined
  let executableName = 'unknown'

  try {
    const executablePath = await downloadAndUnzipVSCode()
    executableName = path.basename(executablePath)
    const args = [
      '--extensionDevelopmentPath=' + rootPath,
      ...(disableExtensions ? ['--disable-extensions'] : []),
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--user-data-dir=' + directories.userData,
      '--extensions-dir=' + directories.extensions,
      '--wait',
      testWorkspace,
    ]

    electronApp = await electron.launch({
      executablePath,
      args,
      timeout,
    })
    diagnostics = new ProcessDiagnostics(electronApp.process())

    try {
      const page = await electronApp.firstWindow({ timeout })
      return {
        page,
        close: () => closeVSCodeSession(electronApp, diagnostics, directoryLease),
      }
    } catch {
      throw createLifecycleError('first-window', attemptId, executableName, diagnostics)
    }
  } catch (error) {
    const primaryError =
      error instanceof VSCodeLifecycleError
        ? error
        : createLifecycleError('launch', attemptId, executableName, diagnostics)

    try {
      await closeVSCodeSession(electronApp, diagnostics, directoryLease)
    } catch {
      primaryError.noteCleanupFailure()
    }

    throw primaryError
  }
}

class VSCodeLifecycleError extends Error {
  noteCleanupFailure(): void {
    this.message += ' cleanup=failed'
  }
}

function createLifecycleError(
  phase: 'launch' | 'first-window',
  attemptId: string,
  executableName: string,
  diagnostics?: ProcessDiagnostics,
): VSCodeLifecycleError {
  const processState = diagnostics?.format() ?? 'exitCode=unknown signal=none'
  return new VSCodeLifecycleError(
    `VS Code lifecycle failure: phase=${phase} attempt=${attemptId} executable=${executableName} ${processState}`,
  )
}

async function closeVSCodeSession(
  electronApp: ElectronApplication | undefined,
  diagnostics: ProcessDiagnostics | undefined,
  directoryLease: VSCodeTempDirectoryLease,
): Promise<void> {
  try {
    if (electronApp && !diagnostics?.hasExited()) {
      const closed = await settleWithin(electronApp.close(), 5000)
      if (!closed) {
        await terminateAndWait(electronApp.process())
      }
    }
  } catch {
    if (electronApp) {
      await terminateAndWait(electronApp.process())
    }
  } finally {
    diagnostics?.dispose()
    await directoryLease.cleanup()
  }
}

async function terminateAndWait(child: ChildProcess): Promise<void> {
  terminateChildProcess(child)
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  let onExit: (() => void) | undefined
  const exited = new Promise<void>((resolve) => {
    onExit = resolve
    child.once('exit', onExit)
  })

  await settleWithin(exited, 2000)
  if (onExit) {
    child.off('exit', onExit)
  }
}

async function settleWithin(operation: Promise<unknown>, timeout: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeout)
    timer.unref()
  })

  try {
    return await Promise.race([operation.then(() => true), timedOut])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
