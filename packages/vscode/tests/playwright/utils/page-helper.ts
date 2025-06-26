import type { Page, ElectronApplication } from '@playwright/test'
import { TIMEOUTS, SELECTORS, KEYBOARD_SHORTCUTS, WAIT_TIMES } from './constants'

export interface PageHelperTimeouts {
  workbench?: number
  commandPalette?: number
  fileExplorer?: number
  editor?: number
}

export class VSCodePageHelper {
  private page: Page
  private timeouts: Required<PageHelperTimeouts>

  constructor(page: Page, timeouts: PageHelperTimeouts = {}) {
    this.page = page
    this.timeouts = {
      workbench: timeouts.workbench || TIMEOUTS.DEFAULT_WORKBENCH,
      commandPalette: timeouts.commandPalette || TIMEOUTS.DEFAULT_COMMAND_PALETTE,
      fileExplorer: timeouts.fileExplorer || TIMEOUTS.DEFAULT_FILE_EXPLORER,
      editor: timeouts.editor || TIMEOUTS.DEFAULT_EDITOR,
    }
  }

  static async create(electronApp: ElectronApplication, timeouts?: PageHelperTimeouts): Promise<VSCodePageHelper> {
    const page = await electronApp.firstWindow()

    const helper = new VSCodePageHelper(page, timeouts)
    await helper.waitForWorkbench()

    return helper
  }

  async waitForWorkbench(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(WAIT_TIMES.DOM_LOAD)
    await this.page.waitForSelector(SELECTORS.WORKBENCH, { timeout: this.timeouts.workbench })
  }

  async openCommandPalette(): Promise<void> {
    await this.page.keyboard.press(KEYBOARD_SHORTCUTS.COMMAND_PALETTE)
    await this.page.waitForSelector(SELECTORS.COMMAND_PALETTE, { timeout: this.timeouts.commandPalette })
  }

  async executeCommand(commandName: string): Promise<void> {
    await this.openCommandPalette()
    await this.page.keyboard.type(commandName)
    await this.page.waitForTimeout(WAIT_TIMES.COMMAND_APPEAR)

    const commandItems = await this.page.$$(SELECTORS.COMMAND_ITEM)

    if (commandItems.length === 0) {
      throw new Error(`No commands found for: ${commandName}`)
    }

    const firstCommand = await commandItems[0].textContent()

    if (!firstCommand?.includes(commandName)) {
      throw new Error(`Expected command "${commandName}" but found "${firstCommand}"`)
    }

    await this.page.keyboard.press('Enter')
    await this.page.waitForTimeout(WAIT_TIMES.COMMAND_EXECUTION)
  }

  async executeCommandWithInput(commandName: string, inputValue: string): Promise<void> {
    await this.executeCommand(commandName)

    // Wait for input dialog to appear
    await this.page.waitForSelector(SELECTORS.INPUT_BOX, { timeout: this.timeouts.commandPalette })

    // Type the input value
    await this.page.fill(SELECTORS.INPUT_BOX, inputValue)
    await this.page.waitForTimeout(WAIT_TIMES.INPUT_RESPONSE)

    // Press Enter to submit
    await this.page.keyboard.press(KEYBOARD_SHORTCUTS.ENTER)
    await this.page.waitForTimeout(WAIT_TIMES.STUDIO_LAUNCH)
  }

  async waitForStudioTab(timeout: number = 10000): Promise<boolean> {
    try {
      await this.page.waitForSelector(SELECTORS.STUDIO_TAB, { timeout })
      return true
    } catch {
      return false
    }
  }

  async checkForStudioTab(): Promise<boolean> {
    // Check if there's a Studio tab opened
    const studioTab = await this.page.$(SELECTORS.STUDIO_TAB)
    return studioTab !== null
  }

  async checkForWebview(): Promise<boolean> {
    // Check if there's a webview element (which Studio uses)
    const webview = await this.page.$(SELECTORS.WEBVIEW)
    return webview !== null
  }

  async openFileExplorer(): Promise<void> {
    await this.page.keyboard.press(KEYBOARD_SHORTCUTS.FILE_EXPLORER)
    await this.page.waitForTimeout(WAIT_TIMES.EXPLORER_TOGGLE)
  }

  async openFile(filename: string): Promise<void> {
    await this.openFileExplorer()

    // Verify the file is visible in explorer
    const explorerContent = await this.page.textContent(SELECTORS.EXPLORER)
    if (!explorerContent?.includes(filename)) {
      throw new Error(`File "${filename}" not found in explorer`)
    }

    // Open the file
    await this.page.click(`text=${filename}`)
    await this.page.waitForTimeout(WAIT_TIMES.FILE_OPEN)
  }

  async getEditorContent(): Promise<string> {
    const editorContent = await this.page.textContent(SELECTORS.EDITOR)
    if (!editorContent) {
      throw new Error('No editor content found')
    }
    return editorContent
  }

  async getCleanEditorContent(): Promise<string> {
    const content = await this.getEditorContent()
    // Remove line numbers and extra whitespace
    return content.replace(/^\d+/gm, '').trim()
  }
}
