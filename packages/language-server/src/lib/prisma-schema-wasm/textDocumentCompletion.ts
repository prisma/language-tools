import { CompletionParams, CompletionList } from 'vscode-languageserver'
import { prismaSchemaWasm } from '.'
import { handleFormatPanic, handleWasmError } from './internals'
import { PrismaSchema } from '../Schema'

/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-return */

// This can't panic / throw exceptions. Any panic here should be considered a
// bug to be fixed. prisma-schema-wasm will return an empty CompletionList on error.
export default function textDocumentCompletion(
  schema: PrismaSchema,
  params: CompletionParams,
  onError?: (errorMessage: string) => void,
): CompletionList {
  // CompletionParams.textDocument doesn't match the Language Server JSON-RPC protocol
  // as defined by the spec. In the spec, it is an object with one property:
  // uri, which is a string. The above `params` are a structured object with
  // methods, and `__uri` and `__contents` properties.
  //
  // prisma-schema-wasm expects something spec-compliant, so we enforce this here.
  const correctParams: any = params
  correctParams['textDocument'] = { uri: params.textDocument.uri }
  const stringifiedParams = JSON.stringify(correctParams)
  try {
    if (process.env.FORCE_PANIC_PRISMA_SCHEMA) {
      handleFormatPanic(() => {
        console.debug('Triggering a Rust panic...')
        prismaSchemaWasm.debug_panic()
      })
    }

    const response = prismaSchemaWasm.text_document_completion(JSON.stringify(schema), stringifiedParams)
    return JSON.parse(response)
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'text_document_completion', onError)

    return {
      isIncomplete: true,
      items: [],
    }
  }
}
