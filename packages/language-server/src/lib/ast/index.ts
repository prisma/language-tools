import { TextDocument } from 'vscode-languageserver-textdocument'
import { getCurrentLine } from './findAtPosition'

export * from './block'
export * from './configBlock'
export * from './fields'
export * from './findAtPosition'
export * from './relations'
export * from './nativeTypes'

export function convertDocumentTextToTrimmedLineArray(document: TextDocument): string[] {
  return Array(document.lineCount)
    .fill(0)
    .map((_, i) => getCurrentLine(document, i).trim())
}
