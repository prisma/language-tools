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
    if (onError) {
      onError(
        "prisma-fmt error'd during formatting. To get a more detailed output please see Prisma Language Server output. To see the output, go to View > Output from the toolbar, then select 'Prisma Language Server' in the Output panel.",
      )
    }
    console.warn(
      "\nprisma-fmt error'd during formatting. Please report this issue on [Prisma Language Tools](https://github.com/prisma/language-tools/issues). \nLinter output:\n",
    )
    console.warn(errors)

    return text
  }
}
