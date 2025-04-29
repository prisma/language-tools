import { Hover, HoverParams } from 'vscode-languageserver'
import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'
import { PrismaSchema } from '../Schema'
import { TextDocument } from 'vscode-languageserver-textdocument'

export default function hover(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: HoverParams,
  onError?: (errorMessage: string) => void,
): Hover | undefined {
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const result = prismaSchemaWasm.hover(JSON.stringify(schema), JSON.stringify(params))

    return JSON.parse(result) as Hover | undefined
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'hover', onError)

    return undefined
  }
}
