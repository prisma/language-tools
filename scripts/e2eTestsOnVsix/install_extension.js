const vscodeTest = require('@vscode/test-electron')
const childProcess = require('child_process')

async function installExtension({ extensionType, extensionVersion }) {
  try {
    let vsceArgument = ''
    if (extensionType === 'insider') {
      vsceArgument = '-insider'
    }
    const extensionName = `Prisma.prisma${vsceArgument}`

    // Install VSCode
    const vscodeExecutablePath = await vscodeTest.downloadAndUnzipVSCode('stable')

    console.debug({ vscodeExecutablePath })

    // Install VSCode extension
    const [cli, ...args] = vscodeTest.resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath)

    console.debug({ cli })
    console.debug({ args })

    const result = childProcess.spawnSync(cli, ['--install-extension', `${extensionName}@${extensionVersion}`], {
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    console.log(result)
    if (result.stderr.includes('Failed')) {
      console.log("It's not ready to be installed yet.")
      return 'FAIL'
    } else {
      console.log('::set-output name=installed-extension::true')
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
