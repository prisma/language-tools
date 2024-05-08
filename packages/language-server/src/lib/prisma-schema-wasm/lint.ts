import { prismaSchemaWasm } from '.'
import { PrismaSchema } from '../Schema'
import { handleFormatPanic, handleWasmError } from './internals'

export interface LinterError {
  file_name: string
  start: number
  end: number
  text: string
  is_warning: boolean
}

export default function lint(schema: PrismaSchema, onError?: (errorMessage: string) => void): LinterError[] {
  console.log('running lint() from prisma-schema-wasm')
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.lint(JSON.stringify(schema))

    return JSON.parse(result) as LinterError[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'lint', onError)

    return []
  }
}
