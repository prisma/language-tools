import prismaFmt from '@prisma/prisma-fmt-wasm'
import * as lsp from 'vscode-languageserver'

/// This can't fail.
export default function textDocumentCompletion(schema: string, params: lsp.CompletionParams): lsp.CompletionList {
    const stringifiedParams = JSON.stringify(params);
    console.log("Params to text_document_completion: ");
    console.log(stringifiedParams);
  return JSON.parse(prismaFmt.text_document_completion(schema, stringifiedParams))
}
