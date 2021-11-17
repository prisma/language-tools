import prismaFmt from '@prisma/prisma-fmt-wasm'

export default function referentialActions(
  text: string,
  onError?: (errorMessage: string) => void,
): string[] {
  const result = prismaFmt.referential_actions(JSON.stringify({ input: text }))
  return JSON.parse(result) as string[]
}
