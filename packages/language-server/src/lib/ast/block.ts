import { Position, Range } from 'vscode-languageserver'

import { BlockType } from '../types'

import { getFieldType } from './fields'
import { getBlockAtPosition } from './findAtPosition'
import { PrismaSchema, SchemaDocument } from '../Schema'

export interface Block {
  type: BlockType
  range: Range
  nameRange: Range
  name: string
  definingDocument: SchemaDocument
}

// Note: this is a generator function, which returns a Generator object.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*
export function* getBlocks(schema: PrismaSchema): Generator<Block, void, void> {
  let blockName = ''
  let blockType = ''
  let blockNameRange: Range | undefined
  let blockStart: Position = Position.create(0, 0)
  const allowedBlockIdentifiers: BlockType[] = ['model', 'type', 'enum', 'datasource', 'generator', 'view']

  for (const { document, lineIndex, text } of schema.iterLines()) {
    // if start of block: `BlockType name {`
    if (allowedBlockIdentifiers.some((identifier) => text.startsWith(identifier)) && text.includes('{')) {
      if (blockType && blockNameRange) {
        // Recover from missing block end
        yield {
          type: blockType as BlockType,
          range: Range.create(blockStart, Position.create(lineIndex - 1, 0)),
          nameRange: blockNameRange,
          name: blockName,
          definingDocument: document,
        }
        blockType = ''
        blockNameRange = undefined
      }

      const index = text.search(/\s+/)
      blockType = ~index ? (text.slice(0, index) as BlockType) : (text as BlockType)
      blockName = text.slice(blockType.length, text.length - 2).trimStart()
      const startCharacter = text.length - 2 - blockName.length
      blockName = blockName.trimEnd()
      blockNameRange = Range.create(lineIndex, startCharacter, lineIndex, startCharacter + blockName.length)
      blockStart = Position.create(lineIndex, 0)
      continue
    }

    // if end of block: `}`
    if (text.startsWith('}') && blockType && blockNameRange) {
      yield {
        type: blockType as BlockType,
        range: Range.create(blockStart, Position.create(lineIndex, 1)),
        nameRange: blockNameRange,
        name: blockName,
        definingDocument: document,
      }
      blockType = ''
      blockNameRange = undefined
    }
  }
}

export function getDatamodelBlock(blockName: string, schema: PrismaSchema): Block | void {
  // get start position of block
  const results = schema
    .linesAsArray()
    .map(({ document, lineIndex, text }) => {
      if (
        (text.includes('model') || text.includes('type') || text.includes('enum') || text.includes('view')) &&
        text.includes(blockName)
      ) {
        return [document, lineIndex]
      }
    })
    .filter((result) => result !== undefined) as [SchemaDocument, number][]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map(([document, lineNo]) => {
      const block = getBlockAtPosition(document.uri, lineNo, schema)
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

export function getFieldsFromCurrentBlock(schema: PrismaSchema, block: Block, position?: Position): string[] {
  const fieldNames: string[] = []
  const lines = block.definingDocument.lines

  for (let lineIndex = block.range.start.line + 1; lineIndex < block.range.end.line; lineIndex++) {
    if (!position || lineIndex !== position.line) {
      const line = lines[lineIndex].text
      const fieldName = getFieldNameFromLine(line)
      if (fieldName) {
        fieldNames.push(fieldName)
      }
    }
  }

  return fieldNames
}

export type FoundLocation = {
  document: SchemaDocument
  lineIndex: number
}

export type RenameFieldLocation = {
  fieldName: string
  locations: FoundLocation[]
}

export function getFieldTypesFromCurrentBlock(schema: PrismaSchema, block: Block, position?: Position) {
  const fieldTypes = new Map<string, RenameFieldLocation>()
  const fieldTypeNames: Record<string, string> = {}

  let reachedStartLine = false
  for (const { document, lineIndex, text: line } of schema.iterLines()) {
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
          fieldTypes.set(fieldType, { locations: [{ document, lineIndex }], fieldName })
          fieldTypeNames[fieldName] = fieldType
        } else {
          existingFieldType.locations.push({ document, lineIndex })
          fieldTypes.set(fieldType, existingFieldType)
        }
      }
    }
  }
  return { fieldTypes, fieldTypeNames }
}

export function getCompositeTypeFieldsRecursively(
  schema: PrismaSchema,
  compositeTypeFieldNames: string[],
  fieldTypesFromBlock: {
    fieldTypes: Map<string, RenameFieldLocation>
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

  const typeBlock = getDatamodelBlock(fieldTypeName, schema)
  if (!typeBlock || typeBlock.type !== 'type') {
    return []
  }

  // if we are not at the end of the composite type, continue recursively
  if (compositeTypeFieldNames.length) {
    return getCompositeTypeFieldsRecursively(
      schema,
      compositeTypeFieldNames,
      getFieldTypesFromCurrentBlock(schema, typeBlock),
    )
  } else {
    return getFieldsFromCurrentBlock(schema, typeBlock)
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

export const getDocumentationForBlock = (block: Block): string[] => {
  return getDocumentation(block.definingDocument, block.range.start.line, [])
}

const getDocumentation = (document: SchemaDocument, line: number, comments: string[]): string[] => {
  const comment = document.lines[line - 1]?.untrimmedText ?? ''

  if (comment.startsWith('///')) {
    comments.unshift(comment.slice(4).trim())

    return getDocumentation(document, line - 1, comments)
  }
  return comments
}
