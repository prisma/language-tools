import { CodeAction } from 'vscode-languageserver'
import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'

export default function codeActions(
  schema: string,
  params: string,
  onError?: (errorMessage: string) => void,
): CodeAction[] {
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.code_actions(schema, params)

    return JSON.parse(result) as CodeAction[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'code_actions', onError)

    return []
  }
}
