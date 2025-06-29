import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/playwright',
  timeout: process.env.CI ? 120000 : 60000, // Longer timeout for CI
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests sequentially for VS Code
  reporter: process.env.CI ? [['github'], ['html']] : 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'vscode-extension',
      use: {
        // Note: headless doesn't apply to Electron apps
        // Headless mode is controlled via VS Code arguments in vscode-setup.ts
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
