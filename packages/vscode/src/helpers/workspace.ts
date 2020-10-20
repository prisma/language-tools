import fs from 'fs'
import path from 'path'
import { workspace } from 'vscode'
type PackageScopes = 'devDependencies' | 'dependencies' | 'peerDependencies'
export async function packageJsonIncludes(
  packageName: string,
  scopes: PackageScopes[],
): Promise<boolean> {
  const rootPath = workspace.rootPath
  const pkgPath = rootPath && path.join(rootPath, 'package.json')
  if (rootPath && pkgPath && fs.existsSync(pkgPath)) {
    const packageJson = await require(pkgPath) // eslint-disable-line
    for (const scope of scopes) {
      // eslint-disable-next-line
      const dependencies = packageJson && packageJson[scope]
      if (dependencies) {
        const packages = Object.keys(dependencies)
        return packages.includes(packageName)
      }
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
