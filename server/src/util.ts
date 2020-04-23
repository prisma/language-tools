/**
 * Imports
 */
import { getPlatform, Platform } from '@prisma/get-platform'
import pkgdir from 'pkg-dir'
import path from 'path'

/**
 * Lookup Cache
 */
let platform: Platform | undefined
let version: string | undefined

/**
 * Try requiring
 */
function tryRequire(path: string): any {
  try {
    return require(path)
  } catch (err) {
    return {}
  }
}

/**
 * Lookup version
 */
async function getVersion(): Promise<string> {
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
 * Get the exec path
 */
export async function getSdkQueryEnginePath(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || (await getVersion())
  const extension = platform === 'windows' ? '.exe' : ''
  const sdkDir = path.dirname(require.resolve('@prisma/sdk/package.json'))
  return path.join(sdkDir, `query-engine-${platform}${extension}`)
}

/**
 * Gets the download URL for a platform
 */
export async function getDownloadURL(): Promise<string> {
  platform = platform || (await getPlatform())
  version = version || (await getVersion())
  const extension = platform === 'windows' ? '.exe.gz' : '.gz'
  return `https://binaries.prisma.sh/master/${version}/${platform}/prisma-fmt${extension}`
}
