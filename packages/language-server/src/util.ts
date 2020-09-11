/**
 * Imports
 */
import { getPlatform, Platform } from '@prisma/get-platform'
import path from 'path'
import fs from 'fs'
import exec from './exec'
const packageJson = require('../../package.json') // eslint-disable-line

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
  if (!packageJson || !packageJson.prisma || !packageJson.prisma.version) {
    return 'latest'
  }
  // eslint-disable-next-line
  return packageJson.prisma.version
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

export function getCLIVersion(): string {
  // eslint-disable-next-line
  return packageJson.dependencies['@prisma/get-platform']
}

export async function binaryIsNeeded(path: string): Promise<boolean> {
  if (!fs.existsSync(path)) {
    return true
  }

  // try to execute version command
  try {
    await exec(path, ['--version'], '')
    console.log('Binary test successful.')
    return false
  } catch (errors) {
    console.log('Binary test failed. Re-attempting a download.')
    console.log(errors)
    return true
  }
}
