import exec from './exec'

export interface LinterError {
  start: number
  end: number
  text: string
  is_warning: boolean
}

export default async function lint(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): Promise<LinterError[]> {
  try {
    const result = await exec(execPath, ['lint'], text)
    return JSON.parse(result) // eslint-disable-line @typescript-eslint/no-unsafe-return
  } catch (errors) {
    const errorMessage = "prisma-fmt error'd during linting.\n"

    if (onError) {
      onError(errorMessage + errors) // eslint-disable-line @typescript-eslint/restrict-plus-operands
    }

    console.error(errorMessage)
    console.error(errors)
    return []
  }
}
