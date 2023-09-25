import type { TextDocument } from 'vscode-languageserver-textdocument'
import { Position } from 'vscode-languageserver'

import nativeTypeConstructors, { NativeTypeConstructors } from './prisma-schema-wasm/nativeTypes'

import { getCurrentLine } from './ast'

export function convertDocumentTextToTrimmedLineArray(document: TextDocument): string[] {
  return Array(document.lineCount)
    .fill(0)
    .map((_, i) => getCurrentLine(document, i).trim())
}

export function getValuesInsideSquareBrackets(line: string): string[] {
  const regexp = /\[([^\]]+)\]/
  const matches = regexp.exec(line)
  if (!matches || !matches[1]) {
    return []
  }
  const result = matches[1].split(',').map((name) => {
    name = name
      // trim whitespace
      .trim()
      // remove ""?
      .replace('"', '')
      .replace('"', '')

    // Remove period at the end for composite types
    if (name.endsWith('.')) {
      return name.slice(0, -1)
    }

    return name
  })

  return result
}

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

export function extractBlockName(line: string): string {
  const blockType = extractFirstWord(line)
  return line.slice(blockType.length, line.length - 1).trim()
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

export function getAllTypeNames(lines: string[]): string[] {
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

export function isInsideFieldArgument(currentLineUntrimmed: string, position: Position): boolean {
  const symbols = '()'
  let numberOfOpenBrackets = 0
  let numberOfClosedBrackets = 0
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === symbols[0]) {
      numberOfOpenBrackets++
    } else if (currentLineUntrimmed[i] === symbols[1]) {
      numberOfClosedBrackets++
    }
  }
  return numberOfOpenBrackets >= 2 && numberOfOpenBrackets > numberOfClosedBrackets
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
