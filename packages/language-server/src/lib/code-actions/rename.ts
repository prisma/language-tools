import { Position } from 'vscode-languageserver'
import type { TextEdit, TextDocument } from 'vscode-languageserver-textdocument'

import {
  Block,
  getBlockAtPosition,
  getCurrentLine,
  getFieldTypesFromCurrentBlock,
  getAllRelationNames,
  getValuesInsideSquareBrackets,
  getWordAtPosition,
} from '../ast'
import { BlockType } from '../types'
import { MAX_SAFE_VALUE_i32, relationNamesRegexFilter } from '../constants'

function getType(currentLine: string): string {
  const wordsInLine: string[] = currentLine.split(/\s+/)
  if (wordsInLine.length < 2) {
    return ''
  }
  return wordsInLine[1].replace('?', '').replace('[]', '')
}

export function isRelationField(currentLine: string, lines: string[]): boolean {
  const relationNames = getAllRelationNames(lines, relationNamesRegexFilter)
  const type = getType(currentLine)

  if (type == '') {
    return false
  }

  return relationNames.includes(type)
}

function extractFirstWord(line: string): string {
  return line.replace(/ .*/, '')
}

export function isValidFieldName(
  currentLine: string,
  position: Position,
  block: Block,
  document: TextDocument,
): boolean {
  if (
    block.type === 'datasource' ||
    block.type === 'generator' ||
    block.type === 'enum' ||
    position.line == block.range.start.line ||
    position.line == block.range.end.line
  ) {
    return false
  }
  if (currentLine.startsWith('@')) {
    return false
  }

  // check if position is inside first word
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const firstWord = extractFirstWord(currentLine)
  const indexOfFirstWord = currentLineUntrimmed.indexOf(firstWord)

  const isFieldName: boolean =
    indexOfFirstWord <= position.character && indexOfFirstWord + firstWord.length >= position.character

  if (!isFieldName) {
    return false
  }

  // remove type modifiers
  const type = getType(currentLine)
  return type !== '' && type !== undefined
}

export const isDatamodelBlockName = (
  position: Position,
  block: Block,
  lines: string[],
  document: TextDocument,
): boolean => {
  // TODO figure out how to use DatamodelBlockType
  if (!['model', 'view', 'type', 'enum'].includes(block.type)) {
    return false
  }

  if (position.line !== block.range.start.line) {
    return renameDatamodelBlockWhereUsedAsType(block, lines, document, position)
  }

  switch (block.type) {
    case 'model':
      return position.character > 5

    case 'enum':
    case 'view':
    case 'type':
      return position.character > 4

    default:
      return false
  }
}

function renameDatamodelBlockWhereUsedAsType(
  block: Block,
  lines: string[],
  document: TextDocument,
  position: Position,
): boolean {
  // TODO type?
  if (block.type !== 'model') {
    return false
  }

  const allRelationNames: string[] = getAllRelationNames(lines, relationNamesRegexFilter)
  const currentName = getWordAtPosition(document, position)
  const isRelation = allRelationNames.includes(currentName)
  if (!isRelation) {
    return false
  }
  const indexOfRelation = lines.findIndex((l) => l.startsWith(block.type) && l.includes(currentName))
  return indexOfRelation !== -1
}

export function isEnumValue(line: string, position: Position, block: Block, document: TextDocument): boolean {
  return (
    block.type === 'enum' &&
    position.line !== block.range.start.line &&
    !line.startsWith('@@') &&
    !getWordAtPosition(document, position).startsWith('@')
  )
}

export function printLogMessage(
  currentName: string,
  newName: string,
  isBlockRename: boolean,
  isFieldRename: boolean,
  isEnumValueRename: boolean,
  blockType: BlockType,
): void {
  const message = `'${currentName}' was renamed to '${newName}'`
  let typeOfRename = ''
  if (isBlockRename) {
    typeOfRename = `${blockType} `
  } else if (isFieldRename) {
    typeOfRename = 'Field '
  } else if (isEnumValueRename) {
    typeOfRename = 'Enum value '
  }
  console.log(typeOfRename + message)
}

function insertInlineRename(currentName: string, line: number): TextEdit {
  return {
    range: {
      start: {
        line: line,
        character: MAX_SAFE_VALUE_i32,
      },
      end: {
        line: line,
        character: MAX_SAFE_VALUE_i32,
      },
    },
    newText: ` @map("${currentName}")`,
  }
}

function insertMapBlockAttribute(oldName: string, block: Block): TextEdit {
  return {
    range: {
      start: {
        line: block.range.end.line,
        character: 0,
      },
      end: block.range.end,
    },
    newText: `\t@@map("${oldName}")\n}`,
  }
}

function positionIsNotInsideSearchedBlocks(line: number, searchedBlocks: Block[]): boolean {
  if (searchedBlocks.length === 0) {
    return true
  }
  return !searchedBlocks.some((block) => line >= block.range.start.line && line <= block.range.end.line)
}

/**
 * Renames references in any '@@index', '@@id' and '@@unique' attributes in the same model.
 * Renames references in any referenced fields inside a '@relation' attribute in the same model (fields: []).
 * Renames references inside a '@relation' attribute in other model blocks (references: []).
 */
export function renameReferencesForFieldName(
  currentName: string,
  newName: string,
  document: TextDocument,
  lines: string[],
  block: Block,
  isRelationFieldRename: boolean,
): TextEdit[] {
  const edits: TextEdit[] = []
  const searchStringsSameBlock = ['@@index', '@@id', '@@unique']
  const relationAttribute = '@relation'
  // search in same model first
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (key === block.range.end.line) {
      break
    }
    if (item.includes(relationAttribute) && item.includes(currentName) && !isRelationFieldRename) {
      // search for fields references
      const currentLineUntrimmed = getCurrentLine(document, key)
      const indexOfFieldsStart = currentLineUntrimmed.indexOf('fields:')
      const indexOfFieldEnd = currentLineUntrimmed.slice(indexOfFieldsStart).indexOf(']') + indexOfFieldsStart
      const fields = currentLineUntrimmed.slice(indexOfFieldsStart, indexOfFieldEnd + 1)
      const indexOfFoundValue = fields.indexOf(currentName)
      const fieldValues = getValuesInsideSquareBrackets(fields)
      if (indexOfFoundValue !== -1 && fieldValues.includes(currentName)) {
        // found a referenced field
        edits.push({
          range: {
            start: {
              line: key,
              character: indexOfFieldsStart + indexOfFoundValue,
            },
            end: {
              line: key,
              character: indexOfFieldsStart + indexOfFoundValue + currentName.length,
            },
          },
          newText: newName,
        })
      }
    }
    // search for references in index, id and unique block attributes
    if (searchStringsSameBlock.some((s) => item.includes(s)) && item.includes(currentName)) {
      const currentLineUntrimmed = getCurrentLine(document, key)
      const valuesInsideBracket = getValuesInsideSquareBrackets(currentLineUntrimmed)
      if (valuesInsideBracket.includes(currentName)) {
        const indexOfCurrentValue = currentLineUntrimmed.indexOf(currentName)
        edits.push({
          range: {
            start: {
              line: key,
              character: indexOfCurrentValue,
            },
            end: {
              line: key,
              character: indexOfCurrentValue + currentName.length,
            },
          },
          newText: newName,
        })
      }
    }
  }

  // search for references in other model blocks
  for (const [index, value] of lines.entries()) {
    if (value.includes(block.name) && value.includes(currentName) && value.includes(relationAttribute)) {
      const currentLineUntrimmed = getCurrentLine(document, index)
      // get the index of the second word
      const indexOfReferences = currentLineUntrimmed.indexOf('references:')
      const indexOfReferencesEnd = currentLineUntrimmed.slice(indexOfReferences).indexOf(']') + indexOfReferences
      const references = currentLineUntrimmed.slice(indexOfReferences, indexOfReferencesEnd + 1)
      const indexOfFoundValue = references.indexOf(currentName)
      const referenceValues = getValuesInsideSquareBrackets(references)
      if (indexOfFoundValue !== -1 && referenceValues.includes(currentName)) {
        edits.push({
          range: {
            start: {
              line: index,
              character: indexOfReferences + indexOfFoundValue,
            },
            end: {
              line: index,
              character: indexOfReferences + indexOfFoundValue + currentName.length,
            },
          },
          newText: newName,
        })
      }
    }
  }

  return edits
}

/**
 * Renames references where the current enum value is used as a default value in other model blocks.
 */
export function renameReferencesForEnumValue(
  currentValue: string,
  newName: string,
  document: TextDocument,
  lines: string[],
  enumName: string,
): TextEdit[] {
  const edits: TextEdit[] = []
  const searchString = `@default(${currentValue})`

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
        newText: `@default(${newName})`,
      })
    }
  }
  return edits
}

/**
 * Renames references where the model name is used as a relation type in the same and other model blocks.
 */
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
    if (value.includes(currentName) && positionIsNotInsideSearchedBlocks(index, searchedBlocks)) {
      const block = getBlockAtPosition(index, lines)
      // TODO type here
      if (block && block.type == 'model') {
        searchedBlocks.push(block)
        // search for field types in current block
        const fieldTypes = getFieldTypesFromCurrentBlock(lines, block)
        for (const fieldType of fieldTypes.fieldTypes.keys()) {
          if (fieldType.replace('?', '').replace('[]', '') === currentName) {
            // replace here
            const foundFieldTypes = fieldTypes.fieldTypes.get(fieldType)
            if (!foundFieldTypes?.lineIndexes) {
              return edits
            }
            for (const lineIndex of foundFieldTypes.lineIndexes) {
              const currentLineUntrimmed = getCurrentLine(document, lineIndex)
              const wordsInLine: string[] = lines[lineIndex].split(/\s+/)
              // get the index of the second word
              const indexOfFirstWord = currentLineUntrimmed.indexOf(wordsInLine[0])
              const indexOfCurrentName = currentLineUntrimmed.indexOf(
                currentName,
                indexOfFirstWord + wordsInLine[0].length,
              )
              edits.push({
                range: {
                  start: {
                    line: lineIndex,
                    character: indexOfCurrentName,
                  },
                  end: {
                    line: lineIndex,
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
  }
  return edits
}

function mapFieldAttributeExistsAlready(line: string): boolean {
  return line.includes('@map(')
}

function mapBlockAttributeExistsAlready(block: Block, lines: string[]): boolean {
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (key === block.range.end.line) {
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

export function mapExistsAlready(
  currentLine: string,
  lines: string[],
  block: Block,
  isDatamodelBlockRename: boolean,
): boolean {
  if (isDatamodelBlockRename) {
    return mapBlockAttributeExistsAlready(block, lines)
  } else {
    return mapFieldAttributeExistsAlready(currentLine)
  }
}

export function insertMapAttribute(
  currentName: string,
  position: Position,
  block: Block,
  isDatamodelBlockRename: boolean,
): TextEdit {
  if (isDatamodelBlockRename) {
    return insertMapBlockAttribute(currentName, block)
  } else {
    return insertInlineRename(currentName, position.line)
  }
}

export function extractCurrentName(
  line: string,
  isBlockRename: boolean,
  isEnumValueRename: boolean,
  isFieldRename: boolean,
  document: TextDocument,
  position: Position,
): string {
  if (isBlockRename) {
    const currentLineUntrimmed = getCurrentLine(document, position.line)
    const currentLineTillPosition = currentLineUntrimmed
      .slice(0, position.character + currentLineUntrimmed.slice(position.character).search(/\W/))
      .trim()
    const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)
    if (wordsBeforePosition.length < 2) {
      return ''
    }
    return wordsBeforePosition[1]
  }
  if (isEnumValueRename || isFieldRename) {
    return extractFirstWord(line)
  }
  return ''
}
