import { Position, Range } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { BlockType } from '../types'
import { MAX_SAFE_VALUE_i32 } from '../constants'

import { getFieldType } from './fields'
import { getBlockAtPosition } from './findAtPosition'

export class Block {
  type: BlockType
  range: Range
  nameRange: Range
  name: string

  constructor(type: BlockType, range: Range, nameRange: Range, name: string) {
    this.type = type
    this.range = range
    this.nameRange = nameRange
    this.name = name
  }
}

// Note: this is a generator function, which returns a Generator object.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*
export function* getBlocks(lines: string[]): Generator<Block, void, void> {
  let blockName = ''
  let blockType = ''
  let blockNameRange: Range | undefined
  let blockStart: Position = Position.create(0, 0)
  const allowedBlockIdentifiers: BlockType[] = ['model', 'type', 'enum', 'datasource', 'generator', 'view']

  for (const [key, item] of lines.entries()) {
    // if start of block: `BlockType name {`
    if (allowedBlockIdentifiers.some((identifier) => item.startsWith(identifier)) && item.includes('{')) {
      if (blockType && blockNameRange) {
        // Recover from missing block end
        yield new Block(
          blockType as BlockType,
          Range.create(blockStart, Position.create(key - 1, 0)),
          blockNameRange,
          blockName,
        )
        blockType = ''
        blockNameRange = undefined
      }

      const index = item.search(/\s+/)
      blockType = ~index ? (item.slice(0, index) as BlockType) : (item as BlockType)
      blockName = item.slice(blockType.length, item.length - 2).trimStart()
      const startCharacter = item.length - 2 - blockName.length
      blockName = blockName.trimEnd()
      blockNameRange = Range.create(key, startCharacter, key, startCharacter + blockName.length)
      blockStart = Position.create(key, 0)
      continue
    }

    // if end of block: `}`
    if (item.startsWith('}') && blockType && blockNameRange) {
      yield new Block(
        blockType as BlockType,
        Range.create(blockStart, Position.create(key, 1)),
        blockNameRange,
        blockName,
      )
      blockType = ''
      blockNameRange = undefined
    }
  }
}

export function getDatamodelBlock(blockName: string, lines: string[]): Block | void {
  // get start position of block
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') || line.includes('type') || line.includes('enum') || line.includes('view')) &&
        line.includes(blockName)
      ) {
        return index
      }
    })
    .filter((index) => index !== undefined) as number[]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map((result) => {
      const block = getBlockAtPosition(result, lines)
      if (block && block.name === blockName) {
        return block
      }
    })
    .filter((block) => block !== undefined) as Block[]

  if (foundBlocks.length !== 1) {
    return
  }

  if (!foundBlocks[0]) {
    return
  }

  return foundBlocks[0]
}

export function getFieldsFromCurrentBlock(lines: string[], block: Block, position?: Position): string[] {
  const fieldNames: string[] = []

  for (let lineIndex = block.range.start.line + 1; lineIndex < block.range.end.line; lineIndex++) {
    if (!position || lineIndex !== position.line) {
      const line = lines[lineIndex]
      const fieldName = getFieldNameFromLine(line)
      if (fieldName) {
        fieldNames.push(fieldName)
      }
    }
  }

  return fieldNames
}

export function getFieldTypesFromCurrentBlock(lines: string[], block: Block, position?: Position) {
  const fieldTypes = new Map<string, { lineIndexes: number[]; fieldName: string | undefined }>()
  const fieldTypeNames: Record<string, string> = {}

  let reachedStartLine = false
  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.range.end.line) {
      break
    }
    if (!line.startsWith('@@') && (!position || lineIndex !== position.line)) {
      const fieldType = getFieldType(line)

      if (fieldType !== undefined) {
        const existingFieldType = fieldTypes.get(fieldType)
        if (!existingFieldType) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const fieldName = getFieldNameFromLine(line)!
          fieldTypes.set(fieldType, { lineIndexes: [lineIndex], fieldName })
          fieldTypeNames[fieldName] = fieldType
        } else {
          existingFieldType.lineIndexes.push(lineIndex)
          fieldTypes.set(fieldType, existingFieldType)
        }
      }
    }
  }
  return { fieldTypes, fieldTypeNames }
}

export function getCompositeTypeFieldsRecursively(
  lines: string[],
  compositeTypeFieldNames: string[],
  fieldTypesFromBlock: {
    fieldTypes: Map<
      string,
      {
        lineIndexes: number[]
        fieldName: string | undefined
      }
    >
    fieldTypeNames: Record<string, string>
  },
): string[] {
  const compositeTypeFieldName = compositeTypeFieldNames.shift()

  if (!compositeTypeFieldName) {
    return []
  }

  const fieldTypeNames = fieldTypesFromBlock.fieldTypeNames
  const fieldTypeName = fieldTypeNames[compositeTypeFieldName]

  if (!fieldTypeName) {
    return []
  }

  const typeBlock = getDatamodelBlock(fieldTypeName, lines)
  if (!typeBlock || typeBlock.type !== 'type') {
    return []
  }

  // if we are not at the end of the composite type, continue recursively
  if (compositeTypeFieldNames.length) {
    return getCompositeTypeFieldsRecursively(
      lines,
      compositeTypeFieldNames,
      getFieldTypesFromCurrentBlock(lines, typeBlock),
    )
  } else {
    return getFieldsFromCurrentBlock(lines, typeBlock)
  }
}

// TODO (Joël) a regex for \w in first position would be better?
function getFieldNameFromLine(line: string) {
  if (line.startsWith('//') || line.startsWith('@@')) {
    return undefined
  }

  const firstPartOfLine = line.replace(/ .*/, '')

  return firstPartOfLine
}

export const getDocumentationForBlock = (document: TextDocument, block: Block): string[] => {
  return getDocumentation(document, block.range.start.line, [])
}

const getDocumentation = (document: TextDocument, line: number, comments: string[]): string[] => {
  const comment = document.getText({
    start: { line: line - 1, character: 0 },
    end: { line: line - 1, character: MAX_SAFE_VALUE_i32 },
  })

  if (comment.startsWith('///')) {
    comments.unshift(comment.slice(4).trim())

    return getDocumentation(document, line - 1, comments)
  }
  return comments
}
