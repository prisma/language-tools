import core from '@actions/core'
import execa from 'execa'
import pRetry from 'p-retry'

async function getVersionFromMarketplace({ extensionId }) {
  const command = await execa('./node_modules/.bin/vsce', [
    'show',
    `${extensionId}`,
    '--json',
  ])

  if (!command.stdout || command.stdout === 'undefined') {
    console.error(command)
    throw new Error('stdout is undefined - the command failed.')
  }

  if (command.exitCode !== 0) {
    console.error(command)
    throw new Error(`exitCode is ${command.exitCode}`)
  }

  // console.debug(command.stdout)
  const result = JSON.parse(command.stdout)
  return result.versions[0].version
}

async function main() {
  const insiderVersion = await pRetry(
    () => getVersionFromMarketplace({ extensionId: 'Prisma.prisma-insider' }),
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.error(error)
        console.error(
          `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
        )
      },
    },
  )
  console.debug(`Currently published insider extension version: ${insiderVersion}`)
  core.setOutput('insider_version', insiderVersion)

  const stableVersion = await pRetry(
    () => getVersionFromMarketplace({ extensionId: 'Prisma.prisma' }),
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.error(error)
        console.error(
          `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
        )
      },
    },
  )
  console.debug(`Currently published stable extension version:: ${stableVersion}`)
  core.setOutput('stable_version', stableVersion)
}

await main()

