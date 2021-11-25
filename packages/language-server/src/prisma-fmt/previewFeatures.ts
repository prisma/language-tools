import prismaFmt from '@prisma/prisma-fmt-wasm'

export default function previewFeatures(
  onError?: (errorMessage: string) => void,
): string[] {
  console.log('running preview_features() from prisma-fmt')
  try {
    const result = prismaFmt.preview_features()
    return JSON.parse(result) as string[]
  } catch (err) {
    const errorMessage =
      "prisma-fmt error'd during getting available preview features.\n"

    if (onError) {
      onError(errorMessage + err)
    }
    return []
  }
}
