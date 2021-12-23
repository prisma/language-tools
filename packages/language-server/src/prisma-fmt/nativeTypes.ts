import prismaFmt from '@prisma/prisma-fmt-wasm'

export interface NativeTypeConstructors {
  name: string
  _number_of_args: number
  _number_of_optional_args: number
  prisma_types: string[]
}

export default function nativeTypeConstructors(
  text: string,
  onError?: (errorMessage: string) => void,
): NativeTypeConstructors[] {
  console.log('running native_types() from prisma-fmt')
  try {
    const result = prismaFmt.native_types(text)
    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (e) {
    const errorMessage =
      "prisma-fmt error'd during getting available native types.\n"

    if (onError) {
      onError(`${errorMessage} ${e as string}`)
    }

    console.error(errorMessage)
    console.error(e)

    return []
  }
}
