/**
 * Imports
 */
const packageJson = require('../../../package.json') // eslint-disable-line

/**
 * Lookup version
 */
export function getVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (
    !packageJson ||
    !packageJson.prisma ||
    !packageJson.prisma.enginesVersion
  ) {
    return 'latest'
  }
  // eslint-disable-next-line
  return packageJson.prisma.enginesVersion
}

/**
 * Gets Engines Version from package.json, dependencies, `@prisma/get-platform`
 * @returns Something like `2.26.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d`
 */
export function getEnginesVersion(): string {
  // eslint-disable-next-line
  return packageJson.dependencies['@prisma/get-platform']
}

/**
 * Gets CLI Version from package.json, prisma, cliVersion
 * @returns Something like `2.27.0-dev.50`
 */
export function getCliVersion(): string {
  return packageJson.prisma.cliVersion
}
