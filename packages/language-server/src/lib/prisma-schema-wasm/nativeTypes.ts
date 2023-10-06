import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'

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
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA_LOCAL) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.native_types(text)

    return JSON.parse(result) as NativeTypeConstructors[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'native_types', onError)

    return []
  }
}
