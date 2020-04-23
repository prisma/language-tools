import exec from './exec'

export default async function format(
  execPath: string,
  identWidth: number,
  text: string,
): Promise<string> {
  try {
    return await exec(execPath, ['format', '-s', identWidth.toString()], text)
  } catch (errors) {
    console.warn(
      "prisma-fmt error'd during formatting. This was likely due to a syntax error. Please see linter output.",
    )
    return text
  }
}
