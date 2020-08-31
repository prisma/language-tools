import { nextVersion, bumpExtensionVersionInScriptFiles } from './versions/bump_extension_version'


function currentLSPVersion({
  branch_channel
}) {
  switch (branch_channel) {
    case 'master':
    case 'dev':
      return readFile({ fileName: "lsp-dev" })
    case 'latest':
      return readFile({ fileName: "lsp-latest" })
    case 'patch-dev':
      return readFile({ fileName: "lsp-patch-dev" })
    default:
      if (branch_channel.endsWith('.x')) {
        return readFile({ fileName: "lsp-patch-dev" })
      }
  }
}

module.exports = { currentLSPVersion }

if (require.main === module) {
  const args = process.argv.slice(2)
  const currentVersion = currentLSPVersion({
    branch_channel: args[0]
  })
  console.log(`Current version: ${currentVersion}`)
  const version = nextVersion({
    currentVersion,
    branch_channel: args[0],
  })
  console.log(`Next LSP version ${version}.`)
  console.log(`::set-output name=version::${version}`)
  bumpExtensionVersionInScriptFiles({
    nextVersion: version,
    branch_channel: args[0],
    extensionBump: false
  })
  return version
}