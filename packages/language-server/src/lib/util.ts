import type { TextDocument } from 'vscode-languageserver-textdocument'

import nativeTypeConstructors, { NativeTypeConstructors } from './prisma-schema-wasm/nativeTypes'

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

export function extractFirstWord(line: string): string {
  return line.replace(/ .*/, '')
}

export function getAllRelationNames(lines: string[], regexFilter: RegExp): string[] {
  const modelNames: string[] = []
  for (const line of lines) {
    const result = regexFilter.exec(line)
    if (result && result[2]) {
      modelNames.push(result[2])
    }
  }
  return modelNames
}

export function getFieldType(line: string): string | undefined {
  const wordsInLine: string[] = line.split(/\s+/)
  if (wordsInLine.length < 2) {
    return undefined
  }
  // Field type is in second position
  // myfield String
  const fieldType = wordsInLine[1]
  if (fieldType.length !== 0) {
    return fieldType
  }
  return undefined
}

// TODO UNUSED
export function extractBlockName(line: string): string {
  const blockType = extractFirstWord(line)
  return line.slice(blockType.length, line.length - 1).trim()
}

export function getAllTypeBlockNames(lines: string[]): string[] {
  const typeNames: string[] = []
  for (const line of lines) {
    const typeRegex = /^type\s+(\w+)\s+{/gm
    const result = typeRegex.exec(line)
    if (result && result[1]) {
      typeNames.push(result[1])
    }
  }
  return typeNames
}
