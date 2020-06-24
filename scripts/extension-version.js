const semVer = require('semver')

function nextExtensionVersion({
  prismaVersion,
  extensionVersion,
  isExtensionOnlyCommit = false,
}) {
  const isBeta = prismaVersion.includes('beta')
  const derivedExtensionVersion = getDerivedExtensionVersion(
    stripPreReleaseText(prismaVersion),
    isBeta,
  )

  console.log(extensionVersion)
  const existingExtensionVersion = coerceExtensionVersion(
    extensionVersion,
    isBeta,
  )

  if (
    derivedExtensionVersion === existingExtensionVersion &&
    isExtensionOnlyCommit
  ) {
    // Extension only publish
    return bumpExtensionOnlyVersion(extensionVersion)
  } else if (
    derivedExtensionVersion === existingExtensionVersion &&
    !isExtensionOnlyCommit
  ) {
    throw new Error(
      `derivedExtensionVersion === existingExtensionVersion but isExtensionOnlyCommit is false. This can happen if there were multiple versions of Prisma CLI released in a quick succession.`,
    )
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

function coerceExtensionVersion(version, isBeta = false) {
  const tokens = version.split('.') //?

  // Because https://github.com/prisma/vscode/issues/121#issuecomment-623327393
  if (isBeta) {
    tokens[1] = 1
  }
  return semVer.coerce(tokens.join('.')).toString()
}

function bumpExtensionOnlyVersion(version) {
  const tokens = version.split('.')
  console.log(tokens)
  if (tokens.length === 3) {
    ++tokens[2]
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
