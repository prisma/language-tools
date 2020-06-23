/**
 * Imports
 */
import { getPlatform, Platform } from '@prisma/get-platform'
import pkgdir from 'pkg-dir'
import path from 'path'
import fs from 'fs'
import exec from './exec'

/**
 * Lookup Cache
 */
let platform: Platform | undefined
let version: string | undefined

/**
 * Try requiring
 */
export function tryRequire(path: string): any {
  try {
    return require(path)
  } catch (err) {
    console.error(err)
    return
  }
}

/**
 * Lookup version
 */
export async function getVersion(): Promise<string> {
  const pkgPath = await pkgdir(__dirname)
  if (!pkgPath) {
    return 'latest'
  }
  const pkg = tryRequire(path.join(pkgPath, 'package.json'))
  if (!pkg['prisma'] || !pkg['prisma']['version']) {
    return 'latest'
  }
  return pkg['prisma']['version']
}

/**
 * Get the exec path
 */
export async function getBinPath(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || (await getVersion())
  const extension = platform === 'windows' ? '.exe' : ''
  return path.join(__dirname, `prisma-fmt.${version}${extension}`)
}

/**
 * Gets the download URL for a platform
 */
export async function getDownloadURL(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || (await getVersion())
  const extension = platform === 'windows' ? '.exe.gz' : '.gz'
  return `https://binaries.prisma.sh/all_commits/${version}/${platform}/prisma-fmt${extension}`
}

export async function getCLIVersion(): Promise<string> {
  const pkgPath = await pkgdir(__dirname)
  if (!pkgPath) {
    return ''
  }
  const pkg = tryRequire(path.join(pkgPath, 'package.json'))
  return pkg['dependencies']['@prisma/get-platform']
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
