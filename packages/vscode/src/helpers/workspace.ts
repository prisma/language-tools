import fs from 'fs'
import path from 'path'
import { workspace } from 'vscode'
export async function packageJsonIncludes(
  packageName: string,
): Promise<boolean> {
  const rootPath = workspace.rootPath
  if (rootPath) {
    const packageJson = await require(path.join(rootPath, 'package.json')) // eslint-disable-line
    // eslint-disable-next-line
    const dependencies = packageJson && packageJson['dependencies']
    if (dependencies) {
      const packages = Object.keys(dependencies)
      return packages.includes(packageName)
    }
  }
  return false
}
export function getExecutor(): 'npx' | 'yarn' | null {
  const rootPath = workspace.rootPath
  if (rootPath) {
    const packageLockPath = path.join(rootPath, 'package-lock.json')
    const yarnLockPath = path.join(rootPath, 'yarn.lock')
    const packageLockPresent = fs.existsSync(packageLockPath)
    const yarnLockPresent = fs.existsSync(yarnLockPath)
    if (packageLockPresent) return 'npx'
    if (yarnLockPresent) return 'yarn'
  }
  return null
}
