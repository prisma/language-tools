const semVer = require('semver')

function nextExtensionVersion({
  prismaVersion,
  extensionVersion,
  isExtensionOnlyCommit = false,
}) {
  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion)
  ).split('.')
  console.log('derivedExtensionVersion: ' + derivedExtensionVersion)
  const existingExtensionVersion = coerceExtensionVersion(
    extensionVersion
  ).split('.')

  console.log('existingExtensionVersion: ' + existingExtensionVersion)

  if ((derivedExtensionVersion[1] !== existingExtensionVersion[1]) && !isExtensionOnlyCommit) {
    console.log('Bump minor.')
    return bumpMinor(extensionVersion)
  } else {
    console.log('Bump patch')
    return bumpPatch(extensionVersion)
  }
}

function stripPreReleaseText(version) {
  return version.replace('-dev', '')
}

function getDerivedExtensionVersion(version) {
  const tokens = version.split('.')

  if (tokens.length === 3) {
    return tokens.join('.')
  }
  throw new Error(
    `Version ${version} must have 3 tokens separated by "." character`,
  )
}

function coerceExtensionVersion(version) {
  const tokens = version.split('.') //?

  return semVer.coerce(tokens.join('.')).toString()
}

function bumpPatch(version) {
  const tokens = version.split('.')
  if (tokens.length === 3) {
    ++tokens[2]
    return tokens.join('.')
  }
  throw new Error(
    `Version ${version} must have 3 tokens separated by "." character`,
  )
}

function bumpMinor(version) {
  const tokens = version.split('.')
  if (tokens.length === 3) {
    ++tokens[1]
    tokens[2] = 0
    return tokens.join('.')
  }
  throw new Error(
    `Version ${version} must have 3 tokens separated by "." character`,
  )
}

module.exports = { nextExtensionVersion }

if (require.main === module) {
  const args = process.argv.slice(2)
  console.log(args)
  const version = nextExtensionVersion({
    prismaVersion: args[0],
    extensionVersion: args[1],
    isExtensionOnlyCommit: args.length === 3 ? args[2] : false
  })
  console.log(version)
}
