import core from '@actions/core'
import { readVersionFile } from '../util.mjs'

export function checkForNewRelease({ type, version }) {
  if (version === undefined) {
    throw new Error(`Version for ${type} is undefined.`)
  }
  const lastTestedVersion = readVersionFile({
    fileName: `tested_extension_${type}`,
  })
  console.log(`Last tested ${type} version: ${lastTestedVersion}`)
  console.log(`Published ${type} version: ${version}`)
  if (lastTestedVersion != version) {
    console.log(`New published version for ${type} available.`)
    core.setOutput(`new_${type}_version`, version)
  }
}

const args = process.argv.slice(2)
if (args.length != 2) {
  throw new Error(`Expected two arguments, received ${args.length}`)
}
console.log(`Published Insider version: ${args[0]}.`)
console.log(`Published stable version: ${args[1]}.`)
checkForNewRelease({ type: 'insider', version: args[0] })
checkForNewRelease({ type: 'stable', version: args[1] })

