import path from 'path'

import { runTests } from 'vscode-test'

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2)
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
        'localLSP': args[0].toString()
      }
    })
  } catch (err) {
    console.error('Failed to run tests')
    process.exit(1)
  }
}

main()
