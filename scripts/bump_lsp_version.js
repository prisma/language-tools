import { bumpExtensionVersionInScriptFiles } from './bump_extension_version'


if (require.main === module) {
  const args = process.argv.slice(2)
  bumpExtensionVersionInScriptFiles({
    nextVersion: args[0],
    branch_channel: args[1],
    extensionBump: false
  })
  return version
}