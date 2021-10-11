/* eslint-disable */

/**
 * Imports
 */
import { getPlatform, Platform } from '@prisma/get-platform'
import path from 'path'
import fs from 'fs'
const packageJson = require('../../../package.json') // eslint-disable-line
/**
 * Lookup Cache
 */
let platform: Platform | undefined
let version: string | undefined

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
 * Get the exec path
 */
export async function getBinPath(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || getVersion()
  const extension = platform === 'windows' ? '.exe' : ''
  return path.join(__dirname, `prisma-fmt.${version}${extension}`)
}

/**
 * Gets the download URL for a platform
 */
export async function getDownloadURL(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || getVersion()
  const extension = platform === 'windows' ? '.exe.gz' : '.gz'
  return `https://binaries.prisma.sh/all_commits/${version}/${platform}/prisma-fmt${extension}`
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

export function binaryIsNeeded(path: string): boolean {
  return !fs.existsSync(path)
}

export function getBinaryVersion(path: string): string {
  try {
    return 'TODO: hardcoded_version'
  } catch (errors) {
    console.log(errors)
    return ''
  }
}

export function testBinarySuccess(path: string): boolean {
  // try to execute version command
  const version = getBinaryVersion(path)
  if (version === '') {
    console.log('Binary test failed. Re-attempting a download.')
    return false
  }
  console.log('Binary test successful.')
  return true
}
