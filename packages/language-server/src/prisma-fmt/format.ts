import prismaFmt from '@prisma/prisma-fmt-wasm'

export default function format(
  identWidth: number,
  text: string,
  onError?: (errorMessage: string) => void,
): string {
  console.log('running format() from prisma-fmt')
  try {
    return prismaFmt.format(text)
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
