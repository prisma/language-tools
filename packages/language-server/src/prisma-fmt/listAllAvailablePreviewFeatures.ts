import { prismaFmt } from '../wasm'
import { handleWasmError } from './util'

export default function listAllAvailablePreviewFeatures(onError?: (errorMessage: string) => void): string[] {
  console.log('running preview_features() from prisma-fmt')
  try {
    const result = prismaFmt.preview_features()

    return JSON.parse(result) as string[]
  } catch (e) {
    const err = e as Error

    handleWasmError(err, 'preview_features', onError)

    return []
  }
}
