import { readVersionFile, getNpmPrismaVersion } from './util'

function checkForUpdate({channel}) {
    const currentPrismaVersion = readVersionFile(`prisma_${channel}`)
    const npmPrismaVersion = getNpmPrismaVersion({channel: channel})

    if (currentPrismaVersion != npmPrismaVersion) {
        console.log(`New Prisma CLI version for ${channel} available.`)
        console.log(`::set-output name=${channel}_version::${npmPrismaVersion}`)
    }
}

module.exports = { checkForUpdate }

if (require.main === module) {
  checkForUpdate({channel: 'dev'})
  checkForUpdate({channel: 'latest'})
  checkForUpdate({channel: 'patch-dev'})
}