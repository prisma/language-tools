const { readVersionFile } = require('./../util')
const execa = require('execa')

function checkForNewRelease({ type }) {
  (async () => {
    const lastTestedVersion = readVersionFile({ fileName: `tested_extension_${type}` })
    console.log(`Last tested ${type} version: ${lastTestedVersion}`)
    let vsceArgument = ''
    if (type === 'insider') {
      vsceArgument = '-insider'
    }
    const { stdout } = await execa('vsce', ['show', `Prisma.prisma${vsceArgument}`, '--json']);
    const publishedVersion = JSON.parse(stdout).versions[0].version
    console.log(`Published ${type} version: ${publishedVersion}`)
    if (lastTestedVersion != publishedVersion) {
      console.log(`New published version for ${type} available.`)
      console.log(`::set-output name=new_${type}_version::${publishedVersion}`)
    }
  })();
}

module.exports = { checkForNewRelease }

if (require.main === module) {
  checkForNewRelease({ type: 'insider' })
  checkForNewRelease({ type: 'stable' })
}