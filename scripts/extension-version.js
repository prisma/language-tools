const semVer = require('semver')

function nextExtensionVersion({
  prismaVersion,
  extensionVersion,
  patchRelease = false,
  prismaStableVersion = '',
  stableMinorRelease = false
}) {

  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion)
  )

  if (patchRelease) {
    // new Prisma patch
    const prismaTokens = prismaVersion.split('.')
    
    const extensionTokens = extensionVersion.split('.')

    if (prismaTokens.length === 3) {
      // extension only patch
      
      if (extensionTokens[0] !== prismaTokens[1]) {
        return `${prismaTokens[1]}.1.1`
      }

      return semVer.inc(extensionVersion, 'patch')
    }
        
    // Prisma CLI patch
    if (derivedExtensionVersion !== prismaVersion) {
      // insider release
      const derivedExtensionTokens = derivedExtensionVersion.split('.')

      if (extensionTokens[0] !== derivedExtensionTokens[0] || extensionTokens[1] !== derivedExtensionTokens[1]) {
        return derivedExtensionVersion
      }

    }
    return semVer.inc(extensionVersion, 'patch')
  }

  if (stableMinorRelease && prismaStableVersion !== '') {
    // check if there already was a insider release after the stable minor release
    const extensionTokens = extensionVersion.split('.')
    const prismaStableTokens = prismaStableVersion.split('.')

    if (prismaStableTokens.length !== 3) {
      throw new Error(
        `Prisma CLI stable Version ${prismaStableVersion} must have 3 tokens separated by "." character`,
      )
    }

    if (extensionTokens[0] === prismaStableTokens[1]) {
      // first new release after stable minor bump --> extensionVersion from x.y.z to (x+1).0.1
      let bumpMajor = semVer.inc(extensionVersion, 'major').split('.')

      return `${bumpMajor[0]}.0.1`
    }

  }

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
  let version = ""
  if (args.length == 2) {
    version = nextExtensionVersion({
      prismaVersion: args[0],
      extensionVersion: args[1],
    })
  } else if (args.length === 3) {
    version = nextExtensionVersion({
      prismaVersion: args[0],
      extensionVersion: args[1],
      patchRelease: true
    })
  } else {
    version = nextExtensionVersion({
      prismaVersion: args[0],
      extensionVersion: args[1],
      patchRelease: false,
      prismaStableVersion: args[3],
      stableMinorRelease: args[4]
    })
  }

  console.log(version)
}
