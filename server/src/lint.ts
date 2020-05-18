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
      if (
        (errors as string) &&
        errors.includes('ParsingError') &&
        text.includes('type')
      ) {
        // recognized Prisma 1 schema
        onError(
          "You are currently viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma VSCode extension doesn't support this syntax. To get proper syntax highlighting for this file, please change the file extension to `.graphql` and download the [GraphQL VSCode extension](https://marketplace.visualstudio.com/items?itemName=Prisma.vscode-graphql). Learn more [here](https://pris.ly/prisma1-vscode).",
        )
      } else {
        onError(errorMessage + errors)
      }
    }

    console.error(errorMessage)
    console.error(errors)
    return []
  }
}
