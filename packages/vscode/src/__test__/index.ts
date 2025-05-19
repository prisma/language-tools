import path from 'path'
import Mocha from 'mocha'
import { glob } from 'glob'

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    timeout: 100_000,
  })

  const testsRoot = __dirname

  const files = await glob('**/**.test.js', { cwd: testsRoot })
  // Add files to the test suite
  files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

  // Run the mocha test
  mocha.run((failures) => {
    if (failures > 0) {
      throw new Error(`${failures} tests failed.`)
    }
  })
}
