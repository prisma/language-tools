const semVer = require('semver')

function nextExtensionVersion({
  prismaVersion,
  extensionVersion,
  patchRelease = false
}) {

  if(patchRelease) {
    return semVer.inc(extensionVersion, 'patch')
  }

  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion)
  )
  console.log(derivedExtensionVersion)

  if (isMajorBump(extensionVersion, derivedExtensionVersion)) {
    return derivedExtensionVersion
  }

  return semVer.inc(extensionVersion, 'patch')
}

function stripPreReleaseText(version) {
  return version.replace('-dev', '')
}

function isMajorBump(prismaVersion, derivedExtensionVersion) {
  const prismaVersionTokens = prismaVersion.split('.')
  const derivedExtensionVersionTokens = derivedExtensionVersion.split('.')

  return prismaVersionTokens[0] !== derivedExtensionVersionTokens[0]
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

module.exports = { nextExtensionVersion }

if (require.main === module) {
  const args = process.argv.slice(2)
  const version = ""
  if (args.length == 2) {
    version = nextExtensionVersion({
      prismaVersion: args[0],
      extensionVersion: args[1],
    })
  } else {
    version = nextExtensionVersion({
      prismaVersion: args[0],
      extensionVersion: args[1],
      patchRelease: true
    }) 
  }
  
  console.log(version)
}
