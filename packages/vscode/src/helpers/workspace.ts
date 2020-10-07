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
