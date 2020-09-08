const fs = require('fs')
const path = require('path')
const semVer = require('semver')

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
      return readFile({ fileName: "extension_insider" })
    case 'latest':
      return readFile({ fileName: "extension_stable" })
    case 'patch-dev':
      return readFile({ fileName: "extension_patch" })
    default:
      if (branch_channel.endsWith('.x')) {
        return readFile({ fileName: "extension_patch" })
      }
  }
}

function stripPreReleaseText(version) {
  return version.replace('-dev', '')
}

function nextVersion({
  currentVersion,
  branch_channel,
}) {
  const prisma_latest = readFile({ fileName: 'prisma_latest' })
  const prisma_dev = stripPreReleaseText(readFile({ fileName: 'prisma_dev' }))
  const prisma_patch = stripPreReleaseText(readFile({ fileName: 'prisma_patch' }))

  const currentVersionTokens = currentVersion.split('.')
  const prisma_dev_tokens = prisma_dev.split('.')
  const prisma_latest_tokens = prisma_latest.split('.')

  switch (branch_channel) {
    case 'master':
    case 'dev':
      // Prisma CLI new dev version
      if (prisma_dev_tokens[2] != currentVersionTokens[1]) {
        // first new release after patch bump --> extensionVersion from x.y.z to x.(y+1).1
        console.log("First new release after patch bump.")
        let bumpMinor = semVer.inc(currentVersion, 'minor').split('.')
        return `${bumpMinor[0]}.${bumpMinor[1]}.1`
      }
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
        if (prisma_latest_tokens[0] !== currentVersionTokens[0]) {
          return `${prisma_latest_tokens[0]}.1.1`
        }
        return semVer.inc(currentVersion, 'patch')
      } else {
        throw new Error("This function needs to be called with a known channel (dev, latest or patch-dev) or the current patch branch name ending with '.x'.")
      }
  }
}

function writeToFile({
  fileName = '',
  content
}) {
  fs.writeFileSync(path.join(__dirname, 'versions', `./${fileName}`), content)
}

function readFile({
  fileName = ''
}) {
  return fs.readFileSync(path.join(__dirname, 'versions', `./${fileName}`), {
    encoding: 'utf-8'
  }).replace('\n', '')
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
      writeToFile({fileName: insiderName, content: nextVersion})
      break
    case 'latest':
      writeToFile({fileName: stableName, content: nextVersion})
      break
    case 'patch-dev':
      writeToFile({fileName: patchName, content: nextVersion})
      break
    default:
      if (branch_channel.endsWith('.x')) {
        writeToFile({fileName: patchName,  content: nextVersion})
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
  })
  console.log(`Next extension version ${version}.`)
  console.log(`::set-output name=next_extension_version::${version}`)
  bumpExtensionVersionInScriptFiles({
    nextVersion: version,
    branch_channel: args[0],
  })
  console.log(`Bumped extension version in scripts/version folder.`)
}