import { readVersionFile } from './util.mjs'
import core from '@actions/core'
import execa from 'execa'
import pRetry from 'p-retry'

async function getVersionFromNpm({ channel }) {
  const { stdout } = await execa('npm', ['show', `prisma@${channel}`, 'version'])

  return stdout
}

async function checkForUpdate({ channel }) {
  const currentPrismaVersion = readVersionFile({
    fileName: `prisma_${channel}`,
  })
  console.log(`current '${channel}': ${currentPrismaVersion}`)

  const npmPrismaVersion = await pRetry(() => getVersionFromNpm({ channel }), {
    retries: 3,
    onFailedAttempt: (error) => {
      console.error(error)
      console.error(
        `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
      )
    },
  })
  console.log(`npm '${channel}': ${npmPrismaVersion}`)

  if (npmPrismaVersion === undefined) {
    throw Error('Could not get current Prisma CLI version.')
  }
  if (currentPrismaVersion != npmPrismaVersion) {
    console.log(`New Prisma CLI version for ${channel} available.`)
    core.setOutput(`${channel}_version`, npmPrismaVersion)
  }
}

export { checkForUpdate }

await checkForUpdate({ channel: 'dev' })
await checkForUpdate({ channel: 'latest' })
await checkForUpdate({ channel: 'patch-dev' })

