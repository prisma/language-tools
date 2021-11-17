import prismaFmt from '@prisma/prisma-fmt-wasm'

export default function previewFeatures(
  onError?: (errorMessage: string) => void,
): string[] {
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
