import path from 'node:path'
import { downloadAndUnzipVSCode } from '@vscode/test-electron'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'

export interface VSCodeSetupOptions {
  rootPath: string
  testWorkspace: string
  disableExtensions?: boolean
  timeout?: number
}

export async function setupVSCode(options: VSCodeSetupOptions): Promise<ElectronApplication> {
  const { rootPath, testWorkspace, disableExtensions = true, timeout = 30000 } = options

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
    '--user-data-dir=' + path.join(__dirname, '../tmp/user-data'),
    '--wait',
    testWorkspace,
  ]

  const electronApp = await electron.launch({
    executablePath,
    args,
    timeout,
  })

  return electronApp
}
