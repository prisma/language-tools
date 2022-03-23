import path from 'path'

import { runTests } from '@vscode/test-electron'

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2)
    if (args.length < 1) {
      console.error('Expected one argument, but received none.')
      process.exit(1)
    }
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../')

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, './index')

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        // This disables all extensions except the one being testing
        '--disable-extensions',
      ],
      extensionTestsEnv: {
        // TODO rename to PRISMA_USE_LOCAL_LS
        localLS: args[0],
      },
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  }
}

main() // eslint-disable-line @typescript-eslint/no-floating-promises
