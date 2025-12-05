import type { ExtensionContext } from 'vscode'

export interface PackageJson {
  name?: string
  version?: string
  [key: string]: unknown
}

export function getPackageJSON(context: ExtensionContext): PackageJson {
  return context.extension.packageJSON as PackageJson
}
