const {readVersionFile } = require('./util')
const execa = require('execa')

function checkForUpdate({channel}) {
  (async () => {
    const currentPrismaVersion = readVersionFile({fileName: `prisma_${channel}`})
    console.log('current: ' + currentPrismaVersion)
    // TODO switch to prisma after next release
    const cliPackageName = channel === 'dev' ? 'prisma' : '@prisma/cli'
    const { stdout } = await execa('npm', ['show', `${cliPackageName}@${channel}`, 'version']);
    const npmPrismaVersion = stdout
    console.log('npm: ' + npmPrismaVersion)
    if (npmPrismaVersion === undefined) {
      throw Error('Could not get current Prisma CLI version.')
    }
    if (currentPrismaVersion != npmPrismaVersion) {
      console.log(`New Prisma CLI version for ${channel} available.`)
      console.log(`::set-output name=${channel}_version::${npmPrismaVersion}`)
  }
  })();
}

module.exports = { checkForUpdate }

if (require.main === module) {
  checkForUpdate({channel: 'dev'})
  checkForUpdate({channel: 'latest'})
  checkForUpdate({channel: 'patch-dev'})
}