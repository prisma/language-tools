import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'

export interface LinterError {
  start: number
  end: number
  text: string
  is_warning: boolean
}

export default function lint(text: string, onError?: (errorMessage: string) => void): LinterError[] {
  console.log('running lint() from prisma-schema-wasm')
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.lint(text)

    return JSON.parse(result) as LinterError[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'lint', onError)

    return []
  }
}
