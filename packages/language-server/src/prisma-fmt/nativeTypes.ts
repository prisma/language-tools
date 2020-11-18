import execa from 'execa'

export interface NativeTypeConstructors {
  name: string
  _number_of_args: number
  _number_of_optional_args: number
  prisma_types: string[]
}

export default function nativeTypeConstructors(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): NativeTypeConstructors[] {
  const result = execa.sync(execPath, ['native-types'], { input: text })

  if (result.exitCode !== 0) {
    const errorMessage =
      "prisma-fmt error'd during getting available native types.\n"

    if (onError) {
      onError(errorMessage + result.stderr)
    }

    console.error(errorMessage)
    console.error(result.stderr)
    return []
  }
  return JSON.parse(result.stdout) as NativeTypeConstructors[]
}
