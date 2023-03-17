import { CodeAction } from 'vscode-languageserver'
import { prismaFmt } from '../wasm'
import { handleWasmError } from './util'

export default function codeActions(
  schema: string,
  params: string,
  onError?: (errorMessage: string) => void,
): CodeAction[] {
  try {
    const result = prismaFmt.code_actions(schema, params)

    return JSON.parse(result) as CodeAction[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'code_actions', onError)

    return []
  }
}
