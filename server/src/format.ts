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
    if (
      (typeof errors === 'string' || errors instanceof String) &&
      errors.includes('ValidationError')
    ) {
      const errorMessage =
        "\nprisma-fmt error'd during formatting. This was due to a syntax error."
      console.warn(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    } else {
      if (onError) {
        onError(
          "prisma-fmt error'd during formatting. Please see Prisma Language Server output. To see the output, go to View > Output from the toolbar, then select 'Prisma Language Server' in the Output panel.",
        )
      }
      console.warn(
        "\nprisma-fmt error'd during formatting. Please report this issue on [Prisma VSCode](https://github.com/prisma/vscode/issues). \nLinter output:\n",
      )
      console.warn(errors)
    }

    return text
  }
}
