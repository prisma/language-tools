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
      "prisma-fmt error'd during formatting. This was likely due to a syntax error. Please see Prisma Language Server output. To see the output, go to View > Output from the toolbar, then select 'Prisma Language Server' in the Output panel."
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
