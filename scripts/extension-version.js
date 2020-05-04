function nextExtensionVersion({ prismaVersion, extensionVersion }) {
  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion),
  )

  const derivedExistingExtensionVersion = getDerivedExtensionVersion(
    extensionVersion,
  )

  if (derivedExtensionVersion === derivedExistingExtensionVersion) {
    // Extension only publish
    return bumpExtensionOnlyVersion(derivedExtensionVersion)
  }
  return derivedExtensionVersion
}

function stripPreReleaseText(version) {
  return version.replace('-alpha', '').replace('-beta', '').replace('-dev', '')
}

function getDerivedExtensionVersion(version) {
  const tokens = version.split('.')
  if (tokens.length === 4) {
    return tokens.slice(1).join('.')
  }
  if (tokens.length === 3) {
    return version
  }
  throw new Error(
    `Version ${version} must have 3 or 4 tokens separated by "." character`,
  )
}

function bumpExtensionOnlyVersion(version) {
  const tokens = version.split('.')
  if (tokens.length === 3) {
    return tokens.join('.') + '.1'
  }
  if (tokens.length === 4) {
    return tokens.slice(0, 3).join('.') + (parseInt(tokens[4]) + 1)
  }
  throw new Error(
    `Version ${version} must have 3 or 4 tokens separated by "." character`,
  )
}

module.exports = { nextExtensionVersion }

if (require.main === module) {
  const args = process.argv.slice(2)
  const version = nextExtensionVersion({
    prismaVersion: args[0],
    extensionVersion: args[1],
  })
  console.log(version)
}
