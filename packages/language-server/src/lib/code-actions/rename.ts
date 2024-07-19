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
import { relationNamesRegexFilter } from '../constants'
import { Line, PrismaSchema } from '../Schema'

function getType(currentLine: string): string {
  const wordsInLine: string[] = currentLine.split(/\s+/)
  if (wordsInLine.length < 2) {
    return ''
  }
  return wordsInLine[1].replace('?', '').replace('[]', '')
}

export function isRelationField(currentLine: string, schema: PrismaSchema): boolean {
  const relationNames = getAllRelationNames(schema, relationNamesRegexFilter)
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
  schema: PrismaSchema,
  document: TextDocument,
): boolean => {
  // TODO figure out how to use DatamodelBlockType
  if (!['model', 'view', 'type', 'enum'].includes(block.type)) {
    return false
  }

  if (position.line !== block.range.start.line) {
    return renameDatamodelBlockWhereUsedAsType(block, schema, document, position)
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
  schema: PrismaSchema,
  document: TextDocument,
  position: Position,
): boolean {
  // TODO type?
  if (block.type !== 'model') {
    return false
  }

  const allRelationNames: string[] = getAllRelationNames(schema, relationNamesRegexFilter)
  const currentName = getWordAtPosition(document, position)
  const isRelation = allRelationNames.includes(currentName)
  if (!isRelation) {
    return false
  }
  const indexOfRelation = schema
    .linesAsArray()
    .findIndex((line) => line.text.startsWith(block.type) && line.text.includes(currentName))
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

function insertInlineRename(currentName: string, line: Line): EditsMap {
  const character = lastNewLineCharacter(line.untrimmedText)
  return {
    [line.document.uri]: [
      {
        range: {
          start: {
            line: line.lineIndex,
            character,
          },
          end: {
            line: line.lineIndex,
            character,
          },
        },
        newText: ` @map("${currentName}")`,
      },
    ],
  }
}

function lastNewLineCharacter(lineText: string) {
  const i = lineText.length - 1
  if (lineText[i] === '\n' && lineText[i - 1] === '\r') {
    return i - 1
  } else if (lineText[i] === '\n') {
    return i
  } else {
    return 0
  }
}

function insertMapBlockAttribute(oldName: string, block: Block): EditsMap {
  return {
    [block.definingDocument.uri]: [
      {
        range: {
          start: {
            line: block.range.end.line,
            character: 0,
          },
          end: block.range.end,
        },
        newText: `\t@@map("${oldName}")\n}`,
      },
    ],
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
  schema: PrismaSchema,
  block: Block,
  isRelationFieldRename: boolean,
): EditsMap {
  const edits: EditsMap = {}
  const searchStringsSameBlock = ['@@index', '@@id', '@@unique']
  const relationAttribute = '@relation'
  // search in same model first
  let reachedStartLine = false
  for (const { document, lineIndex, text, untrimmedText } of schema.iterLines()) {
    if (lineIndex === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.range.end.line) {
      break
    }
    if (text.includes(relationAttribute) && text.includes(currentName) && !isRelationFieldRename) {
      // search for fields references
      const indexOfFieldsStart = untrimmedText.indexOf('fields:')
      const indexOfFieldEnd = untrimmedText.slice(indexOfFieldsStart).indexOf(']') + indexOfFieldsStart
      const fields = untrimmedText.slice(indexOfFieldsStart, indexOfFieldEnd + 1)
      const indexOfFoundValue = fields.indexOf(currentName)
      const fieldValues = getValuesInsideSquareBrackets(fields)
      if (indexOfFoundValue !== -1 && fieldValues.includes(currentName)) {
        // found a referenced field
        appendEdit(edits, document.uri, {
          range: {
            start: {
              line: lineIndex,
              character: indexOfFieldsStart + indexOfFoundValue,
            },
            end: {
              line: lineIndex,
              character: indexOfFieldsStart + indexOfFoundValue + currentName.length,
            },
          },
          newText: newName,
        })
      }
    }
    // search for references in index, id and unique block attributes
    if (searchStringsSameBlock.some((s) => text.includes(s)) && text.includes(currentName)) {
      const valuesInsideBracket = getValuesInsideSquareBrackets(untrimmedText)
      if (valuesInsideBracket.includes(currentName)) {
        const indexOfCurrentValue = untrimmedText.indexOf(currentName)
        appendEdit(edits, document.uri, {
          range: {
            start: {
              line: lineIndex,
              character: indexOfCurrentValue,
            },
            end: {
              line: lineIndex,
              character: indexOfCurrentValue + currentName.length,
            },
          },
          newText: newName,
        })
      }
    }
  }

  // search for references in other model blocks
  for (const { document, lineIndex, text, untrimmedText } of schema.iterLines()) {
    if (text.includes(block.name) && text.includes(currentName) && text.includes(relationAttribute)) {
      // get the index of the second word
      const indexOfReferences = untrimmedText.indexOf('references:')
      const indexOfReferencesEnd = untrimmedText.slice(indexOfReferences).indexOf(']') + indexOfReferences
      const references = untrimmedText.slice(indexOfReferences, indexOfReferencesEnd + 1)
      const indexOfFoundValue = references.indexOf(currentName)
      const referenceValues = getValuesInsideSquareBrackets(references)
      if (indexOfFoundValue !== -1 && referenceValues.includes(currentName)) {
        appendEdit(edits, document.uri, {
          range: {
            start: {
              line: lineIndex,
              character: indexOfReferences + indexOfFoundValue,
            },
            end: {
              line: lineIndex,
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
  schema: PrismaSchema,
  enumName: string,
): EditsMap {
  const edits: EditsMap = {}
  const searchString = `@default(${currentValue})`

  for (const { document, lineIndex, text, untrimmedText } of schema.iterLines()) {
    if (text.includes(searchString) && text.includes(enumName)) {
      // get the index of the second word
      const indexOfCurrentName = untrimmedText.indexOf(searchString)
      appendEdit(edits, document.uri, {
        range: {
          start: {
            line: lineIndex,
            character: indexOfCurrentName,
          },
          end: {
            line: lineIndex,
            character: indexOfCurrentName + searchString.length,
          },
        },
        newText: `@default(${newName})`,
      })
    }
  }
  return edits
}

export type EditsMap = {
  [documentUri: string]: TextEdit[]
}

/**
 * Renames references where the model name is used as a relation type in the same and other model blocks.
 */
export function renameReferencesForModelName(currentName: string, newName: string, schema: PrismaSchema): EditsMap {
  const searchedBlocks = []
  const edits: EditsMap = {}

  for (const { document, lineIndex, text } of schema.iterLines()) {
    // check if inside model
    if (text.includes(currentName) && positionIsNotInsideSearchedBlocks(lineIndex, searchedBlocks)) {
      const block = getBlockAtPosition(document.uri, lineIndex, schema)
      // TODO type here
      if (block && block.type == 'model') {
        searchedBlocks.push(block)
        // search for field types in current block
        const fieldTypes = getFieldTypesFromCurrentBlock(schema, block)
        for (const fieldType of fieldTypes.fieldTypes.keys()) {
          if (fieldType.replace('?', '').replace('[]', '') === currentName) {
            // replace here
            const foundFieldTypes = fieldTypes.fieldTypes.get(fieldType)
            if (!foundFieldTypes?.locations) {
              return edits
            }
            for (const { lineIndex, document: foundDocument } of foundFieldTypes.locations) {
              const currentLineUntrimmed = foundDocument.lines[lineIndex].untrimmedText
              const wordsInLine: string[] = foundDocument.lines[lineIndex].text.split(/\s+/)
              // get the index of the second word
              const indexOfFirstWord = currentLineUntrimmed.indexOf(wordsInLine[0])
              const indexOfCurrentName = currentLineUntrimmed.indexOf(
                currentName,
                indexOfFirstWord + wordsInLine[0].length,
              )
              appendEdit(edits, document.uri, {
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

function mapBlockAttributeExistsAlready(block: Block, schema: PrismaSchema): boolean {
  let reachedStartLine = false
  for (const { lineIndex, text } of schema.iterLines()) {
    if (lineIndex === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.range.end.line) {
      break
    }
    if (text.startsWith('@@map(')) {
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
): EditsMap {
  const currentLineUntrimmed = getCurrentLine(document, line)
  const indexOfCurrentName = currentLineUntrimmed.indexOf(currentName)

  return {
    [document.uri]: [
      {
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
      },
    ],
  }
}

export function mapExistsAlready(
  currentLine: string,
  schema: PrismaSchema,
  block: Block,
  isDatamodelBlockRename: boolean,
): boolean {
  if (isDatamodelBlockRename) {
    return mapBlockAttributeExistsAlready(block, schema)
  } else {
    return mapFieldAttributeExistsAlready(currentLine)
  }
}

export function insertMapAttribute(
  currentName: string,
  position: Position,
  block: Block,
  isDatamodelBlockRename: boolean,
): EditsMap {
  if (isDatamodelBlockRename) {
    return insertMapBlockAttribute(currentName, block)
  } else {
    const line = block.definingDocument.lines[position.line]
    return insertInlineRename(currentName, line)
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

export function appendEdit(edits: EditsMap, documentUri: string, edit: TextEdit): void {
  let docEdits = edits[documentUri]
  if (!docEdits) {
    docEdits = []
    edits[documentUri] = docEdits
  }
  docEdits.push(edit)
}

export function appendEdits(edits: EditsMap, documentUri: string, editsToAppend: TextEdit[]): void {
  for (const edit of editsToAppend) {
    appendEdit(edits, documentUri, edit)
  }
}

export function mergeEditMaps(maps: EditsMap[]): EditsMap {
  const result: EditsMap = {}
  for (const map of maps) {
    for (const [documentUri, edits] of Object.entries(map)) {
      appendEdits(result, documentUri, edits)
    }
  }
  return result
}
