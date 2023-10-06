import { Range, Position } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { MAX_SAFE_VALUE_i32 } from '../types'
import { Block, getBlocks } from '../util'

export function fullDocumentRange(document: TextDocument): Range {
  const lastLineId = document.lineCount - 1
  return {
    start: { line: 0, character: 0 },
    end: { line: lastLineId, character: MAX_SAFE_VALUE_i32 },
  }
}

export function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: MAX_SAFE_VALUE_i32 },
  })
}

export function isFirstInsideBlock(position: Position, currentLine: string): boolean {
  if (currentLine.trim().length === 0) {
    return true
  }

  const stringTilPosition = currentLine.slice(0, position.character)
  const matchArray = /\w+/.exec(stringTilPosition)

  if (!matchArray) {
    return true
  }
  return (
    matchArray.length === 1 &&
    matchArray.index !== undefined &&
    stringTilPosition.length - matchArray.index - matchArray[0].length === 0
  )
}

export function getWordAtPosition(document: TextDocument, position: Position): string {
  const currentLine = getCurrentLine(document, position.line)

  // search for the word's beginning and end
  const beginning: number = currentLine.slice(0, position.character + 1).search(/\S+$/)
  const end: number = currentLine.slice(position.character).search(/\W/)
  if (end < 0) {
    return ''
  }
  return currentLine.slice(beginning, end + position.character)
}

export function getBlockAtPosition(line: number, lines: string[]): Block | void {
  for (const block of getBlocks(lines)) {
    if (block.range.start.line > line) {
      return
    }

    if (line <= block.range.end.line) {
      return block
    }
  }
  return
}
