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
  try {
    const result = prismaFmt.native_types(text)
    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (err) {
    if (onError) {
      onError(`${err}`)
    }

    return []
  }
}
