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
