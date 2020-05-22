import exec from './exec'

export default async function format(
  execPath: string,
  identWidth: number,
  text: string,
  onError?: (errorMessage: string) => void,
): Promise<string> {
  try {
    return await exec(execPath, ['format', '-s', identWidth.toString()], text)
  } catch (errors) {
    const errorMessage =
      "prisma-fmt error'd during formatting. This was likely due to a syntax error. Please see Prisma Language Server output."
    if (onError) {
      onError(errorMessage)
    }
    console.warn(
      "\nprisma-fmt error'd during formatting. This was likely due to a syntax error.\nLinter output:\n",
    )
    console.warn(errors)
    return text
  }
}
