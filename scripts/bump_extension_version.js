const semVer = require('semver')
const { readVersionFile, writeToVersionFile } = require('./util')

function isMinorRelease(
  prismaVersion,
) {
  const tokens = prismaVersion.split('.')
  if (tokens.length !== 3) {
    throw new Error(
      `Version ${prismaVersion} must have 3 tokens separated by "." character.`
    )
  }
  return tokens[2] === '0'
}

function currentExtensionVersion({
  branch_channel
}) {
  switch (branch_channel) {
    case 'master':
    case 'dev':
      return readVersionFile({ fileName: "extension_insider" })
    case 'latest':
      return readVersionFile({ fileName: "extension_stable" })
    case 'patch-dev':
      return readVersionFile({ fileName: "extension_patch" })
    default:
      if (branch_channel.endsWith('.x')) {
        return readVersionFile({ fileName: "extension_patch" })
      }
  }
}

function stripPreReleaseText(version) {
  return version.replace('-dev', '')
}

function getDerivedExtensionVersion(version) {
  const tokens = version.split('.')

  if (tokens.length === 4) {
    return tokens.slice(1).join('.')
  }
  if (tokens.length === 3) {
    return tokens.join('.')
  }
  throw new Error(
    `Version ${version} must have 3 or 4 tokens separated by "." character`,
  )
}

function nextVersion({
  currentVersion,
  branch_channel,
  prisma_latest,
  prisma_dev,
  prisma_patch
}) {
  const currentVersionTokens = currentVersion.split('.')
  const prisma_dev_tokens = stripPreReleaseText(prisma_dev).split('.')
  const prisma_latest_tokens = prisma_latest.split('.')
  const prisma_patch_tokens = stripPreReleaseText(prisma_patch).split('.')

  switch (branch_channel) {
    case 'master':
    case 'dev':
      // Prisma CLI new dev version
      if (prisma_latest_tokens[1] == currentVersionTokens[0]) {
        // first new release after stable minor bump --> extensionVersion from x.y.z to (x+1).0.1
        console.log("First new release after stable minor bump.")
        let bumpMajor = semVer.inc(currentVersion, 'major').split('.')
        return bumpMajor[0] + '.0.1'
      }
      return semVer.inc(currentVersion, 'patch')
    case 'latest':
      // Prisma CLI new latest version
      if (isMinorRelease(prisma_latest)) {
        return prisma_latest
      }
      return semVer.inc(currentVersion, 'patch')
    case 'patch-dev':
      const derivedVersion = getDerivedExtensionVersion(stripPreReleaseText(prisma_patch))
      if (prisma_patch_tokens[0] !== currentVersion[0]) {
        return derivedVersion
      }

      return semVer.inc(currentVersion, 'patch')
    default:
      if (branch_channel.endsWith('.x')) {
        // extension only new patch update
        if (prisma_latest_tokens[1] !== currentVersionTokens[0]) {
          return `${prisma_latest_tokens[1]}.1.1`
        }
        return semVer.inc(currentVersion, 'patch')
      } else {
        throw new Error("This function needs to be called with a known channel (dev, latest or patch-dev) or the current patch branch name ending with '.x'.")
      }
  }
}

function bumpExtensionVersionInScriptFiles({
  nextVersion = '',
  branch_channel = '',
}) {
  let insiderName = "extension_insider"
  let stableName = "extension_stable"
  let patchName = "extension_patch"
  switch (branch_channel) {
    case 'master':
    case 'dev':
      writeToVersionFile({fileName: insiderName, content: nextVersion})
      break
    case 'latest':
      writeToVersionFile({fileName: stableName, content: nextVersion})
      break
    case 'patch-dev':
      writeToVersionFile({fileName: patchName, content: nextVersion})
      break
    default:
      if (branch_channel.endsWith('.x')) {
        writeToVersionFile({fileName: patchName,  content: nextVersion})
      }
  }
}


module.exports = { isMinorRelease, currentExtensionVersion, nextVersion, bumpExtensionVersionInScriptFiles }

if (require.main === module) {
  const args = process.argv.slice(2)
  const currentVersion = currentExtensionVersion({
    branch_channel: args[0]
  })
  console.log(`Current version: ${currentVersion}`)
  const version = nextVersion({
    currentVersion,
    branch_channel: args[0],
    prisma_dev: readVersionFile({ fileName: 'prisma_dev' }),
    prisma_latest: readVersionFile({ fileName: 'prisma_latest' }),
    prisma_patch: readVersionFile({ fileName: 'prisma_patch-dev' })
  })
  console.log(`Next extension version ${version}.`)
  console.log(`::set-output name=next_extension_version::${version}`)
  bumpExtensionVersionInScriptFiles({
    nextVersion: version,
    branch_channel: args[0],
  })
  console.log(`Bumped extension version in scripts/version folder.`)
}