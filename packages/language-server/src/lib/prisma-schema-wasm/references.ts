import { Location, ReferenceParams } from 'vscode-languageserver'
import { PrismaSchema } from '../Schema'
import { handleFormatPanic, handleWasmError } from './internals'
import { prismaSchemaWasm } from '.'

export default function references(
  schema: PrismaSchema,
  params: ReferenceParams,
  onError?: (errorMessage: string) => void,
): Location[] | undefined {
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const response = prismaSchemaWasm.references(JSON.stringify(schema), JSON.stringify(params))

    return JSON.parse(response) as Location[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'references', onError)

    return undefined
  }
}
