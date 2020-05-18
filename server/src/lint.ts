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
      if ((errors as string) && errors.includes('ParsingError')) {
        // recognized Prisma 1 schema
        onError(
          "You are currently viewing a Prisma 1 datamodel which is based on GraphQL syntax. The current Prisma VS Code extension doesn't support this syntax.\n\nTo get proper syntax highlighting for this file, please change its file extension to `.graphql` and download the GraphQL VS Code extension: https://marketplace.visualstudio.com/items?itemName=Prisma.vscode-graphql\n\nLearn more here: https://pris.ly/prisma1-vscode",
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
