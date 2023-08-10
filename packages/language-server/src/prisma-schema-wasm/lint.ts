import { prismaSchemaWasm } from '../wasm'
import { handleFormatPanic, handleWasmError } from './util'

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
    const errors = JSON.parse(result) as LinterError[]
    return errors.filter((error) => {
      try {
        const lastNewLine = text.substring(0, error.start).lastIndexOf('\n')
        const nextNewLine = error.end + text.substring(error.end).indexOf('\n')
        const lineOfCode = text.substring(lastNewLine, nextNewLine)
        return !/\/\/\s*@pls-ignore/.test(lineOfCode)
      } catch (_e) {
        return true
      }
    })
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'lint', onError)

    return []
  }
}
