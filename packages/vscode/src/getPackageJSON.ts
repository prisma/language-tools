import type { ExtensionContext } from 'vscode'

// @ts-expect-error don't worry about the type.
export function getPackageJSON(context: ExtensionContext): import('pkg-types').PackageJson {
  return context.extension.packageJSON as never
}
