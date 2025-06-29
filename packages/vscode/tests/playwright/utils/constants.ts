export const TIMEOUTS = {
  // VS Code startup and initialization
  VSCODE_LAUNCH: 30000,
  WORKBENCH_LOAD: 10000,
  EXTENSION_ACTIVATION: 3000,

  // UI interactions
  COMMAND_PALETTE: 5000,
  FILE_EXPLORER: 3000,
  EDITOR_LOAD: 5000,

  // Command execution
  COMMAND_EXECUTION: 2000,
  COMMAND_SEARCH: 1000,

  // File operations
  FILE_OPEN: 1000,
  EXPLORER_TOGGLE: 500,

  // Default timeouts for page helper
  DEFAULT_WORKBENCH: 10000,
  DEFAULT_COMMAND_PALETTE: 5000,
  DEFAULT_FILE_EXPLORER: 3000,
  DEFAULT_EDITOR: 5000,
} as const

export const SELECTORS = {
  WORKBENCH: '.monaco-workbench',
  COMMAND_PALETTE: '.quick-input-widget',
  COMMAND_ITEM: '.quick-input-list-row',
  EXPLORER: '.explorer-viewlet',
  EDITOR: '.monaco-editor',
  INPUT_BOX: '.quick-input-box input',
  SIMPLE_BROWSER: '.simple-browser-workbench',
  TAB: '.tab',
  STUDIO_TAB: '.tab:has-text("Studio")',
  WEBVIEW: 'webview, iframe, .webview',
} as const

export const COMMANDS = {
  LAUNCH_PRISMA_STUDIO: 'Prisma: Launch Prisma Studio',
} as const

export const KEYBOARD_SHORTCUTS = {
  COMMAND_PALETTE: process.platform === 'darwin' ? 'Meta+Shift+P' : 'Control+Shift+P',
  FILE_EXPLORER: process.platform === 'darwin' ? 'Meta+Shift+E' : 'Control+Shift+E',
  ENTER: 'Enter',
  ESCAPE: 'Escape',
} as const

export const WAIT_TIMES = {
  DOM_LOAD: 3000,
  COMMAND_APPEAR: 1000,
  COMMAND_EXECUTION: 2000,
  FILE_OPEN: 1000,
  EXPLORER_TOGGLE: 500,
  STUDIO_LAUNCH: 5000,
  INPUT_RESPONSE: 1000,
} as const

export const TEST_DATA = {
  FAKE_DATABASE_URL: 'prisma+postgres://user:password@host.example.com:5432/database?schema=public',
} as const
