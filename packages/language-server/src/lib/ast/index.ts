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

// TODO UNUSED
// export function extractBlockName(line: string): string {
//   const blockType = extractFirstWord(line)
//   return line.slice(blockType.length, line.length - 1).trim()
// }

// export function getAllCompositeTypeNames(lines: string[]): string[] {
//   const typeNames: string[] = []
//   for (const line of lines) {
//     const typeRegex = /^type\s+(\w+)\s+{/gm
//     const result = typeRegex.exec(line)
//     if (result && result[1]) {
//       typeNames.push(result[1])
//     }
//   }
//   return typeNames
// }
