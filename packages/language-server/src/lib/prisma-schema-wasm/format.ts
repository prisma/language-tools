import { DocumentFormattingParams } from 'vscode-languageserver'
import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'

export default function format(
  schema: string,
  options: DocumentFormattingParams,
  onError?: (errorMessage: string) => void,
): string {
  console.log('running format() from prisma-schema-wasm')

  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    return prismaSchemaWasm.format(schema, JSON.stringify(options))
  } catch (e) {
    const err = e as Error

    console.warn(
      '\nprisma-schema-wasm errored during formatting. Please report this issue on [Prisma Language Tools](https://github.com/prisma/language-tools/issues). \nLinter output:\n',
    )

    handleWasmError(err, 'format', onError)

    return schema
  }
}
