import { Position } from 'vscode-languageserver'
import { TextEdit, TextDocument } from 'vscode-languageserver-textdocument'
import { getCurrentLine, Block, getBlockAtPosition } from '../MessageHandler'
import { getTypesFromCurrentBlock } from '../completion/completions'

export function isModelOrEnumName(line: string, position: Position): boolean {
  const modelString = 'model'
  const enumString = 'enum'
  const startsWithEnum = line.startsWith(enumString)
  const startsWithModel = line.startsWith(modelString)
  if (!((startsWithEnum || startsWithModel) && line.includes('{'))) {
    return false
  }
  return startsWithEnum
    ? position.character > enumString.length
    : startsWithModel
    ? position.character > modelString.length
    : false
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

export function insertBlockRename(
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
