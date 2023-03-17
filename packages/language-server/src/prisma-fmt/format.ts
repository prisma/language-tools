import { prismaFmt } from '../wasm'
import { DocumentFormattingParams } from 'vscode-languageserver'
import { handleWasmError } from './util'

export default function format(
  schema: string,
  options: DocumentFormattingParams,
  onError?: (errorMessage: string) => void,
): string {
  console.log('running format() from prisma-fmt')
  try {
    return prismaFmt.format(schema, JSON.stringify(options))
  } catch (e) {
    const err = e as Error

    console.warn(
      '\nprisma-fmt errored during formatting. Please report this issue on [Prisma Language Tools](https://github.com/prisma/language-tools/issues). \nLinter output:\n',
    )

    handleWasmError(err, 'format', onError)

    return schema
  }
}
