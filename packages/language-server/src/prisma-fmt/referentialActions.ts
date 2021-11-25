import prismaFmt from '@prisma/prisma-fmt-wasm'

export default function referentialActions(
  text: string,
  onError?: (errorMessage: string) => void,
): string[] {
  try {
    console.log('running referential_actions() from prisma-fmt')
    const result = prismaFmt.referential_actions(text)
    return JSON.parse(result) as string[]
  } catch (err) {
    if (onError) {
      onError(`${err}`)
    }

    return []
  }
}
