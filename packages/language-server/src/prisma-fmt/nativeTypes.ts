import { prismaFmt } from '../wasm'
import { handleFormatPanic, handleWasmError } from './util'

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
    if (process.env.FORCE_PANIC_PRISMA_FMT_LOCAL) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaFmt.debug_panic()
      })
    }

    const result = prismaFmt.native_types(text)

    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'native_types', onError)

    return []
  }
}
