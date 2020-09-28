const { readVersionFile } = require('./../util')

function checkForNewRelease({ type, version }) {

  const lastTestedVersion = readVersionFile({ fileName: `tested_extension_${type}` })
  console.log(`Last tested ${type} version: ${lastTestedVersion}`)
  console.log(`Published ${type} version: ${version}`)
  if (lastTestedVersion != version) {
    console.log(`New published version for ${type} available.`)
    console.log(`::set-output name=new_${type}_version::${version}`)
  }
}

module.exports = { checkForNewRelease }

if (require.main === module) {
  const args = process.argv.slice(2)
  checkForNewRelease({ type: 'insider', version: args[0] })
  checkForNewRelease({ type: 'stable', version: args[1] })
}