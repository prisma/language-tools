import core from '@actions/core'
import * as vscodeTest from '@vscode/test-electron'
import { spawnSync } from 'child_process'

async function installExtension({ extensionType, extensionVersion }) {
  try {
    let vsceArgument = ''
    if (extensionType === 'insider') {
      vsceArgument = '-insider'
    }
    const extensionName = `Prisma.prisma${vsceArgument}`

    // Install VS Code
    const vscodeExecutablePath = await vscodeTest.downloadAndUnzipVSCode('stable')

    console.debug({ vscodeExecutablePath })

    // Install VS Code extension
    const [cli, ...args] =
      vscodeTest.resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

    console.debug({ cli })
    console.debug({ args })

    const result = spawnVscode(cli, ['--install-extension', `${extensionName}@${extensionVersion}`])
    console.log(result)
    if (result.stderr.includes('Failed')) {
      console.log("It's not ready to be installed yet.")
      return 'FAIL'
    } else {
      core.setOutput('installed-extension', true)
      return 'SUCCESS'
    }
  } catch (err) {
    console.error('Failed to install the extension.')
    console.error(err)
    process.exit(1)
  }
}

function spawnVscode(cmd, args) {
  if (process.platform === 'win32' && cmd.endsWith('.cmd')) {
    args = ['/k', cmd, ...args]
    cmd = 'cmd.exe'
  }

  return spawnSync(cmd, args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  })
}

export { installExtension }

const args = process.argv.slice(2)
const result = await installExtension({
  extensionType: args[0],
  extensionVersion: args[1],
})
console.log(result)

