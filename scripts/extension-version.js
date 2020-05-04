function nextExtensionVersion({ prismaVersion, extensionVersion }) {
  const isBeta = prismaVersion.includes('beta')
  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion),
    isBeta,
  )

  const derivedExistingExtensionVersion = getDerivedExtensionVersion(
    extensionVersion,
    isBeta,
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

function getDerivedExtensionVersion(version, isBeta = false) {
  const tokens = version.split('.')

  // Because https://github.com/prisma/vscode/issues/121#issuecomment-623327393
  if (isBeta && tokens.length === 4) {
    tokens[2] = 1
  }
  if (isBeta && tokens.length === 3) {
    tokens[1] = 1
  }

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
