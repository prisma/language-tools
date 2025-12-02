const semVer = require('semver')
const core = require('@actions/core')
const { readVersionFile, writeToVersionFile } = require('./util')

function nextVersion({ currentVersion, trigger, prismaLatest }) {
  switch (trigger) {
    case 'extension-patch-release':
    case 'prisma-dev-release':
    case 'prisma-patch-dev-release':
      return semVer.inc(currentVersion, 'patch')
    case 'extension-minor-release':
      return semVer.inc(currentVersion, 'minor')
    case 'extension-major-release':
      return semVer.inc(currentVersion, 'major')
    case 'prisma-latest-release':
      // Stable release trigger bumps according to Prisma CLI version change
      if (isMajorRelease(prismaLatest)) {
        return semVer.inc(currentVersion, 'major')
      } else if (isMinorRelease(prismaLatest)) {
        return semVer.inc(currentVersion, 'minor')
      } else {
        return semVer.inc(currentVersion, 'patch')
      }
    default:
      throw new Error(
        'This function needs to be called with a known trigger: extension-(patch|minor|major)-release or prisma-(latest|dev|patch-dev)-release.',
      )
  }
}

function currentExtensionVersion() {
  return readVersionFile({ fileName: 'extension_latest' })
}

function bumpExtensionVersionInScriptFiles({ nextVersion }) {
  writeToVersionFile({ fileName: 'extension_latest', content: nextVersion })
}

function isMinorRelease(prismaVersion) {
  const [, minor, patch] = prismaVersion.split('.')
  return minor !== '0' && patch === '0'
}

function isMajorRelease(prismaVersion) {
  const [, minor, patch] = prismaVersion.split('.')
  return minor === '0' && patch === '0'
}

function isMinorOrMajorRelease(prismaVersion) {
  return isMinorRelease(prismaVersion) || isMajorRelease(prismaVersion)
}

module.exports = {
  isMinorOrMajorRelease,
  currentExtensionVersion,
  nextVersion,
  bumpExtensionVersionInScriptFiles,
}

if (require.main === module) {
  const args = process.argv.slice(2)
  const trigger = args[0]

  // Get the current extension version
  const currentVersionOfExtension = currentExtensionVersion()
  console.log(`Current extension version: ${currentVersionOfExtension}`)

  // "Calculate" next version number
  const version = nextVersion({
    currentVersion: currentVersionOfExtension,
    trigger,
    prismaLatest: readVersionFile({ fileName: 'prisma_latest' }),
  })
  console.log(`Next extension version ${version}.`)
  core.setOutput('next_extension_version', version)

  // Bump in file
  bumpExtensionVersionInScriptFiles({ nextVersion: version })
  console.log(`Bumped extension version in scripts/version folder.`)
}
