import type { TextDocument } from 'vscode-languageserver-textdocument'

import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'

export function declaredNativeTypes(document: TextDocument, onError?: (errorMessage: string) => void): boolean {
  const nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(document.getText(), (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (nativeTypes.length === 0) {
    return false
  }
  return true
}
