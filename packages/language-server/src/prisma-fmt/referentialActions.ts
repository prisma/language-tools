import prismaFmt from 'tomhoule-prisma-fmt-wasm-build-experiment/src/prisma_fmt_build'

export default function referentialActions(text: string): string[] {
  const result = prismaFmt.referential_actions(text)
  return JSON.parse(result) as string[]
}
