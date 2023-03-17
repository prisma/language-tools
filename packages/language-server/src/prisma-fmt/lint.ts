import { prismaFmt } from '../wasm'
import { handleWasmError } from './util'

export interface LinterError {
  start: number
  end: number
  text: string
  is_warning: boolean
}

export default function lint(text: string, onError?: (errorMessage: string) => void): LinterError[] {
  console.log('running lint() from prisma-fmt')
  try {
    const result = prismaFmt.lint(text)

    return JSON.parse(result) as LinterError[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'lint', onError)

    return []
  }
}
