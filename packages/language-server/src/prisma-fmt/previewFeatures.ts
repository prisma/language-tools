import execa from 'execa'

export default function previewFeatures(
  execPath: string,
  dataSourceOnly: boolean,
  onError?: (errorMessage: string) => void,
): string[] {
  let result
  if (dataSourceOnly) {
    result = execa.sync(execPath, ['preview-features', '--datasource-only'])
  } else {
    result = execa.sync(execPath, ['preview-features'])
  }

  if (result.exitCode !== 0) {
    const errorMessage =
      "prisma-fmt error'd during getting available preview features.\n"

    if (onError) {
      onError(errorMessage + result.stderr)
    }

    console.error(errorMessage)
    console.error(result.stderr)
    return []
  }
  return JSON.parse(result.stdout) as string[]
}
