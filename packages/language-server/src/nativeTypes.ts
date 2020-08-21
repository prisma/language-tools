import exec from './exec'

export interface NativeTypeConstructors {
    name: string,
    _number_of_args: number,
    _number_of_optional_args: number,
    prisma_type: string,
}

export default async function nativeTypeConstructors(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): Promise<NativeTypeConstructors[]> {
  try {
    const result = await exec(execPath,  ['native-types'], text)
    return JSON.parse(result)
  } catch (errors) {
    const errorMessage = "prisma-fmt error'd during getting available native types.\n"

    if (onError) {
      onError(errorMessage + errors)
    }

    console.error(errorMessage)
    console.error(errors)
    return []
  }
}
