import { Position } from 'vscode-languageserver'
import { TextEdit, TextDocument } from 'vscode-languageserver-textdocument'
import {
  getCurrentLine,
  Block,
  getBlockAtPosition,
  getWordAtPosition,
} from '../MessageHandler'
import { getTypesFromCurrentBlock } from '../completion/completions'

export function extractFirstWord(line: string): string {
  return line.replace(/ .*/, '')
}

export function extractModelName(line: string): string {
  const blockType = extractFirstWord(line)
  return line.slice(blockType.length, line.length - 1).trim()
}

export function isModelOrEnumName(position: Position, block: Block): boolean {
  if (position.line !== block.start.line) {
    return false
  }
  switch (block.type) {
    case 'model':
      return position.character > 5
    case 'enum':
      return position.character > 4
  }
  return false
}

export function isEnumValue(
  currentLine: string,
  position: Position,
  currentBlock: Block,
  document: TextDocument,
): boolean {
  return (
    position.line !== currentBlock.start.line &&
    !currentLine.startsWith('@@') &&
    !getWordAtPosition(document, position).startsWith('@')
  )
}

export function insertInlineRename(
  currentName: string,
  line: number,
): TextEdit {
  return {
    range: {
      start: {
        line: line,
        character: Number.MAX_VALUE,
      },
      end: {
        line: line,
        character: Number.MAX_VALUE,
      },
    },
    newText: '@map("' + currentName + '")',
  }
}

export function insertMapBlockAttribute(
  oldName: string,
  block: Block,
): TextEdit {
  return {
    range: {
      start: {
        line: block.end.line,
        character: 0,
      },
      end: block.end,
    },
    newText: '\t@@map("' + oldName + '")\n}',
  }
}

function positionIsNotInsideSearchedBlocks(
  line: number,
  searchedBlocks: Block[],
): boolean {
  if (searchedBlocks.length === 0) {
    return true
  }
  return !searchedBlocks.some(
    (block) => line >= block.start.line && line <= block.end.line,
  )
}

export function renameReferencesForEnumValue(
  currentValue: string,
  newName: string,
  document: TextDocument,
  lines: string[],
  enumName: string,
): TextEdit[] {
  const edits: TextEdit[] = []
  const searchString = '@default(' + currentValue + ')'

  for (const [index, value] of lines.entries()) {
    if (value.includes(searchString) && value.includes(enumName)) {
      const currentLineUntrimmed = getCurrentLine(document, index)
      // get the index of the second word
      const indexOfCurrentName = currentLineUntrimmed.indexOf(searchString)
      edits.push({
        range: {
          start: {
            line: index,
            character: indexOfCurrentName,
          },
          end: {
            line: index,
            character: indexOfCurrentName + searchString.length,
          },
        },
        newText: '@default(' + newName + ')',
      })
    }
  }
  return edits
}

export function renameReferencesForModelName(
  currentName: string,
  newName: string,
  document: TextDocument,
  lines: string[],
): TextEdit[] {
  const searchedBlocks = []
  const edits: TextEdit[] = []

  for (const [index, value] of lines.entries()) {
    // check if inside model
    if (
      value.includes(currentName) &&
      positionIsNotInsideSearchedBlocks(index, searchedBlocks)
    ) {
      const block = getBlockAtPosition(index, lines)
      if (block && block.type == 'model') {
        searchedBlocks.push(block)
        // search block for references
        const types: Map<string, number> = getTypesFromCurrentBlock(
          lines,
          block,
        )
        for (const f of types.keys()) {
          if (f.replace('?', '').replace('[]', '') === currentName) {
            // replace here
            const line = types.get(f)
            if (!line) {
              return edits
            }
            const currentLineUntrimmed = getCurrentLine(document, line)
            const wordsInLine: string[] = lines[line].split(/\s+/)
            // get the index of the second word
            const indexOfCurrentName = currentLineUntrimmed.indexOf(
              currentName,
              wordsInLine[0].length,
            )
            edits.push({
              range: {
                start: {
                  line: line,
                  character: indexOfCurrentName,
                },
                end: {
                  line: line,
                  character: indexOfCurrentName + currentName.length,
                },
              },
              newText: newName,
            })
          }
        }
      }
    }
  }
  return edits
}

export function mapFieldAttributeExistsAlready(line: string): boolean {
  return line.includes('@map(')
}

export function mapBlockAttributeExistsAlready(
  block: Block,
  lines: string[],
): boolean {
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (key === block.end.line) {
      break
    }
    if (item.startsWith('@@map(')) {
      return true
    }
  }
  return false
}

export function insertBasicRename(
  newName: string,
  currentName: string,
  document: TextDocument,
  line: number,
): TextEdit {
  const currentLineUntrimmed = getCurrentLine(document, line)
  const indexOfCurrentName = currentLineUntrimmed.indexOf(currentName)

  return {
    range: {
      start: {
        line: line,
        character: indexOfCurrentName,
      },
      end: {
        line: line,
        character: indexOfCurrentName + currentName.length,
      },
    },
    newText: newName,
  }
}
