import { TextDocument, Range } from 'vscode-languageserver-textdocument'

export function fullDocumentRange(document: TextDocument): Range {
  const lastLineId = document.lineCount - 1
  return {
    start: { line: 0, character: 0 },
    end: { line: lastLineId, character: Number.MAX_SAFE_INTEGER },
  }
}
