import { DocumentFormattingParams } from 'vscode-languageserver'
import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'
import { PrismaSchema } from '../Schema'
import { TextDocument } from 'vscode-languageserver-textdocument'

export default function format(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
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

    const result = prismaSchemaWasm.format(JSON.stringify(schema), JSON.stringify(options))
    // tuples of [filePath, content]
    const formattedFiles = JSON.parse(result) as Array<[string, string]>
    const formatResult = formattedFiles.find(([uri]) => uri === initiatingDocument.uri)
    if (!formatResult) {
      return initiatingDocument.getText()
    }
    return formatResult[1]
  } catch (e) {
    const err = e as Error

    console.warn(
      '\nprisma-schema-wasm errored during formatting. Please report this issue on [Prisma Language Tools](https://github.com/prisma/language-tools/issues). \nLinter output:\n',
    )

    handleWasmError(err, 'format', onError)

    return initiatingDocument.getText()
  }
}
