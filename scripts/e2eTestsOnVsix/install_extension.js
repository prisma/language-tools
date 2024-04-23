const core = require('@actions/core')
const vscodeTest = require('@vscode/test-electron')
const childProcess = require('child_process')

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
    let [cli, ...args] = vscodeTest.resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

    console.debug({ cli })
    console.debug({ args })

    if (process.platform === 'win32' && cli.endsWith('.cmd')) {
      args.unshift(cli)
      cli = 'cmd.exe'
    }

    const result = childProcess.spawnSync(
      cli,
      [...args, '--install-extension', `${extensionName}@${extensionVersion}`],
      {
        encoding: 'utf-8',
        stdio: 'pipe',
      },
    )
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

module.exports = { installExtension }

if (require.main === module) {
  const args = process.argv.slice(2)
  installExtension({
    extensionType: args[0],
    extensionVersion: args[1],
  }).then((res) => {
    console.log(res)
  })
}
