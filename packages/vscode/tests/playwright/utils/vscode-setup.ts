import type { ChildProcess } from 'node:child_process'
import path from 'node:path'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import {
  createVSCodeTempDirectories,
  ProcessDiagnostics,
  sanitizeDiagnosticText,
  terminateChildProcess,
  VSCodeTempDirectoryLease,
  type VSCodeTempDirectories,
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
  const directories = await createVSCodeTempDirectories(workerIndex, retry)
  const directoryLease = new VSCodeTempDirectoryLease(directories)
  let electronApp: ElectronApplication | undefined
  let diagnostics: ProcessDiagnostics | undefined

  try {
    const executablePath = await downloadAndUnzipVSCode()
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
    } catch (error) {
      throw createLifecycleError('waiting for its first window', error, directories, diagnostics)
    }
  } catch (error) {
    await closeVSCodeSession(electronApp, diagnostics, directoryLease)

    if (error instanceof VSCodeLifecycleError) {
      throw error
    }

    throw createLifecycleError('launching', error, directories, diagnostics)
  }
}

class VSCodeLifecycleError extends Error {}

function createLifecycleError(
  stage: string,
  error: unknown,
  directories: VSCodeTempDirectories,
  diagnostics?: ProcessDiagnostics,
): VSCodeLifecycleError {
  const cause = sanitizeDiagnosticText(error instanceof Error ? error.message : String(error))
  const processContext = diagnostics?.hasExited() ? `\n${diagnostics.format()}` : ''

  return new VSCodeLifecycleError(
    `VS Code failed while ${stage} (isolated attempt ${path.basename(directories.root)}): ${cause}${processContext}`,
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
