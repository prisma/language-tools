import path from 'node:path'
import { test, expect } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'

import { setupVSCode } from './utils/vscode-setup'
import { VSCodePageHelper } from './utils/page-helper'
import { COMMANDS, TIMEOUTS, TEST_DATA } from './utils/constants'

let electronApp: ElectronApplication

const rootPath = path.resolve(__dirname, '../../')
const testWorkspace = path.join(__dirname, '../fixtures/test-workspace')

test.beforeEach(async () => {
  electronApp = await setupVSCode({
    rootPath,
    testWorkspace,
    disableExtensions: true,
    timeout: TIMEOUTS.VSCODE_LAUNCH,
  })
})

test('launches VS Code with Prisma extension', async () => {
  await VSCodePageHelper.create(electronApp)
})

test('can execute Prisma: Launch Prisma Studio command', async () => {
  const helper = await VSCodePageHelper.create(electronApp)

  // Execute the command with a fake database URL
  await helper.executeCommandWithInput(COMMANDS.LAUNCH_PRISMA_STUDIO, TEST_DATA.FAKE_DATABASE_URL)

  // Wait for Studio tab to open
  const studioTabOpened = await helper.waitForStudioTab()
  expect(studioTabOpened).toBe(true)

  // Verify that the Studio tab is actually present
  const hasStudioTab = await helper.checkForStudioTab()
  expect(hasStudioTab).toBe(true)

  // Verify that there's a webview element (Studio runs in a webview)
  const hasWebview = await helper.checkForWebview()
  expect(hasWebview).toBe(true)
})

test('loads Prisma schema file in workspace', async () => {
  const helper = await VSCodePageHelper.create(electronApp)

  await helper.openFile('schema.prisma')

  const cleanContent = await helper.getCleanEditorContent()

  // Check for key Prisma schema elements using regex for flexible matching
  expect(cleanContent).toMatch(/generator\s+client/)
  expect(cleanContent).toMatch(/datasource\s+db/)
  expect(cleanContent).toMatch(/model\s+User/)
  expect(cleanContent).toMatch(/model\s+Post/)
})

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})
