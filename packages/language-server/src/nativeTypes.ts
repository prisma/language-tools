import exec from './exec'

export default async function nativeTypeConstructors(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): Promise<string> {
  try {
    const result = await exec(execPath, ['lint'], text)
    return JSON.parse(result)
  } catch (errors) {
    const errorMessage = "prisma-fmt error'd during getting available native types.\n"

    if (onError) {
      onError(errorMessage + errors)
    }

    console.error(errorMessage)
    console.error(errors)
    return ''
  }
}
