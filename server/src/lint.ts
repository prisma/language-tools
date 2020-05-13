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
          "This file is a GraphQL file and is not supported by the Prisma extension. Please install the GraphQL extension ('https://marketplace.visualstudio.com/items?itemName=Prisma.vscode-graphql') from the marketplace and change the file extension to '.graphql'.",
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
