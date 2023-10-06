import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'

export default function listAllAvailablePreviewFeatures(onError?: (errorMessage: string) => void): string[] {
  console.log('running preview_features() from prisma-schema-wasm')
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA_LOCAL) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.preview_features()

    return JSON.parse(result) as string[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'preview_features', onError)

    return []
  }
}
