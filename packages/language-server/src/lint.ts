import exec from './exec'

export interface LinterError {
  start: number
  end: number
  text: string
}

export default async function lint(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): Promise<LinterError[]> {
  try {
    const result = await exec(execPath, ['lint', '--no-env-errors'], text)
    return JSON.parse(result)
  } catch (errors) {
    const errorMessage = "prisma-fmt error'd during linting.\n"

    if (onError) {
      onError(errorMessage + errors)
    }

    console.error(errorMessage)
    console.error(errors)
    return []
  }
}
