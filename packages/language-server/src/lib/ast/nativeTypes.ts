import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { PrismaSchema } from '../Schema'

export function declaredNativeTypes(schema: PrismaSchema, onError?: (errorMessage: string) => void): boolean {
  const nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(schema, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (nativeTypes.length === 0) {
    return false
  }
  return true
}
