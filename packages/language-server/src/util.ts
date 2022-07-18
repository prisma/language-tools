import type { TextDocument, Range } from 'vscode-languageserver-textdocument'
import { Position } from 'vscode-languageserver'
import nativeTypeConstructors, { NativeTypeConstructors } from './prisma-fmt/nativeTypes'
import { PreviewFeatures } from './previewFeatures'

export type BlockType = 'generator' | 'datasource' | 'model' | 'type' | 'enum'

export class Block {
  type: BlockType
  start: Position
  end: Position
  name: string

  constructor(type: BlockType, start: Position, end: Position, name: string) {
    this.type = type
    this.start = start
    this.end = end
    this.name = name
  }
}

export function fullDocumentRange(document: TextDocument): Range {
  const lastLineId = document.lineCount - 1
  return {
    start: { line: 0, character: 0 },
    end: { line: lastLineId, character: Number.MAX_SAFE_INTEGER },
  }
}

export function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: Number.MAX_SAFE_INTEGER },
  })
}

export function convertDocumentTextToTrimmedLineArray(document: TextDocument): string[] {
  return Array(document.lineCount)
    .fill(0)
    .map((_, i) => getCurrentLine(document, i).trim())
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
  let blockType = ''
  let blockName = ''
  let blockStart: Position = Position.create(0, 0)
  let blockEnd: Position = Position.create(0, 0)
  const allowedBlockIdentifiers: BlockType[] = ['model', 'type', 'enum', 'datasource', 'generator']

  // get block beginning
  let reachedLine = false
  for (const [key, item] of lines.reverse().entries()) {
    const actualIndex = lines.length - 1 - key
    if (actualIndex === line) {
      reachedLine = true
    }
    if (!reachedLine) {
      continue
    }
    if (allowedBlockIdentifiers.some((identifier) => item.startsWith(identifier)) && item.includes('{')) {
      const index = item.search(/\s+/)
      blockType = ~index ? (item.slice(0, index) as BlockType) : (item as BlockType)
      blockName = item.slice(blockType.length, item.length - 2).trim()
      blockStart = Position.create(actualIndex, 0)
      break
    }
    // not inside a block
    if (item.includes('}')) {
      lines.reverse()
      return
    }
  }
  reachedLine = false
  // get block ending
  for (const [key, item] of lines.reverse().entries()) {
    if (key === line) {
      reachedLine = true
    }
    if (!reachedLine) {
      continue
    }
    // check if block ends here
    if (item.startsWith('}') && blockType) {
      blockEnd = Position.create(key, 1)
      return new Block(blockType as BlockType, blockStart, blockEnd, blockName)
    }
  }
  return
}

export function getModelOrTypeOrEnumBlock(blockName: string, lines: string[]): Block | void {
  // get start position of block
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(blockName)) ||
        (line.includes('type') && line.includes(blockName)) ||
        (line.includes('enum') && line.includes(blockName))
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

// TODO can be removed? Since it was renamed to `previewFeatures` a long time ago
export function getExperimentalFeaturesRange(document: TextDocument): Range | undefined {
  const lines = convertDocumentTextToTrimmedLineArray(document)
  const experimentalFeatures = 'experimentalFeatures'
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (item.startsWith('generator') && item.includes('{')) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (reachedStartLine && item.startsWith('}')) {
      return
    }

    if (item.startsWith(experimentalFeatures)) {
      const startIndex = getCurrentLine(document, key).indexOf(experimentalFeatures)
      return {
        start: { line: key, character: startIndex },
        end: { line: key, character: startIndex + experimentalFeatures.length },
      }
    }
  }
}

export function getValuesInsideSquareBrackets(line: string): string[] {
  const regexp = /\[([^\]]+)\]/
  const matches = regexp.exec(line)
  if (!matches || !matches[1]) {
    return []
  }
  const result = matches[1].split(',').map((name) => {
    name = name
      // trim whitespace
      .trim()
      // remove ""?
      .replace('"', '')
      .replace('"', '')

    // Remove period at the end for composite types
    if (name.endsWith('.')) {
      return name.slice(0, -1)
    }

    return name
  })

  return result
}

export function declaredNativeTypes(document: TextDocument): boolean {
  const nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(document.getText())
  if (nativeTypes.length === 0) {
    return false
  }
  return true
}

export function extractFirstWord(line: string): string {
  return line.replace(/ .*/, '')
}

export function extractBlockName(line: string): string {
  const blockType = extractFirstWord(line)
  return line.slice(blockType.length, line.length - 1).trim()
}

export function getAllRelationNames(lines: string[]): string[] {
  const modelNames: string[] = []
  for (const line of lines) {
    const modelOrEnumRegex = /^(model|enum)\s+(\w+)\s+{/gm
    const result = modelOrEnumRegex.exec(line)
    if (result && result[2]) {
      modelNames.push(result[2])
    }
  }
  return modelNames
}

export function getAllTypeNames(lines: string[]): string[] {
  const typeNames: string[] = []
  for (const line of lines) {
    const typeRegex = /^type\s+(\w+)\s+{/gm
    const result = typeRegex.exec(line)
    if (result && result[1]) {
      typeNames.push(result[1])
    }
  }
  return typeNames
}

export function isInsideFieldArgument(currentLineUntrimmed: string, position: Position): boolean {
  const symbols = '()'
  let numberOfOpenBrackets = 0
  let numberOfClosedBrackets = 0
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === symbols[0]) {
      numberOfOpenBrackets++
    } else if (currentLineUntrimmed[i] === symbols[1]) {
      numberOfClosedBrackets++
    }
  }
  return numberOfOpenBrackets >= 2 && numberOfOpenBrackets > numberOfClosedBrackets
}

/***
 * @param symbols expects e.g. '()', '[]' or '""'
 */
export function isInsideAttribute(currentLineUntrimmed: string, position: Position, symbols: string): boolean {
  let numberOfOpenBrackets = 0
  let numberOfClosedBrackets = 0
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === symbols[0]) {
      numberOfOpenBrackets++
    } else if (currentLineUntrimmed[i] === symbols[1]) {
      numberOfClosedBrackets++
    }
  }
  return numberOfOpenBrackets > numberOfClosedBrackets
}

/***
 * Checks if inside e.g. "here"
 * Does not check for escaped quotation marks.
 */
export function isInsideQuotationMark(currentLineUntrimmed: string, position: Position): boolean {
  let insideQuotation = false
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === '"') {
      insideQuotation = !insideQuotation
    }
  }
  return insideQuotation
}

// checks if e.g. inside 'fields' or 'references' attribute
export function isInsideGivenProperty(
  currentLineUntrimmed: string,
  wordsBeforePosition: string[],
  attributeName: string,
  position: Position,
): boolean {
  if (!isInsideAttribute(currentLineUntrimmed, position, '[]')) {
    return false
  }

  // We sort all attributes by their position
  const sortedAttributes = [
    {
      name: 'fields',
      position: wordsBeforePosition.findIndex((word) => word.includes('fields')),
    },
    {
      name: 'references',
      position: wordsBeforePosition.findIndex((word) => word.includes('references')),
    },
  ].sort((a, b) => (a.position < b.position ? 1 : -1))

  // If the last attribute (higher position)
  // is the one we are looking for we are in this attribute
  if (sortedAttributes[0].name === attributeName) {
    return true
  } else {
    return false
  }
}

export function getFieldType(line: string): string | undefined {
  const wordsInLine: string[] = line.split(/\s+/)
  if (wordsInLine.length < 2) {
    return undefined
  }
  // Field type is in second position
  // myfield String
  const fieldType = wordsInLine[1]
  if (fieldType.length !== 0) {
    return fieldType
  }
  return undefined
}

export function getSymbolBeforePosition(document: TextDocument, position: Position): string {
  return document.getText({
    start: {
      line: position.line,
      character: position.character - 1,
    },
    end: { line: position.line, character: position.character },
  })
}

export function positionIsAfterFieldAndType(
  position: Position,
  document: TextDocument,
  wordsBeforePosition: string[],
): boolean {
  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforeIsWhiteSpace = symbolBeforePosition.search(/\s/)

  const hasAtRelation = wordsBeforePosition.length === 2 && symbolBeforePosition === '@'
  const hasWhiteSpaceBeforePosition = wordsBeforePosition.length === 2 && symbolBeforeIsWhiteSpace !== -1

  return wordsBeforePosition.length > 2 || hasAtRelation || hasWhiteSpaceBeforePosition
}

export function getFirstDatasourceName(lines: string[]): string | undefined {
  const datasourceBlockFirstLine = lines.find((l) => l.startsWith('datasource') && l.includes('{'))
  if (!datasourceBlockFirstLine) {
    return undefined
  }
  const indexOfBracket = datasourceBlockFirstLine.indexOf('{')
  return datasourceBlockFirstLine.slice('datasource'.length, indexOfBracket).trim()
}

export function getFirstDatasourceProvider(lines: string[]): string | undefined {
  // matches provider inside datasource in any position
  // thanks to https://regex101.com for the online scratchpad
  const result = /datasource.*\{(\n|\N)\s*(.*\n)?\n*\s*provider\s=\s(\"(.*)\")[^}]+}/.exec(lines.join('\n'))

  if (!result || !result[4]) {
    return undefined
  }

  const datasourceProvider = result[4]
  if (typeof datasourceProvider === 'string' && datasourceProvider.length >= 1) {
    return datasourceProvider
  }
}

export function getAllPreviewFeaturesFromGenerators(lines: string[]): PreviewFeatures[] | undefined {
  // matches any `previewFeatures = [x]` in any position
  // thanks to https://regex101.com for the online scratchpad
  const previewFeaturesRegex = /previewFeatures\s=\s(\[.*\])/g

  // we could match against all the `previewFeatures = [x]` (could be that there is more than one?)
  // var matchAll = text.matchAll(regexp)
  // for (const match of matchAll) {
  //   console.log(match);
  // }
  const result = previewFeaturesRegex.exec(lines.join('\n'))

  if (!result || !result[1]) {
    return undefined
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const previewFeatures = JSON.parse(result[1])
    if (Array.isArray(previewFeatures) && previewFeatures.length > 0) {
      return previewFeatures.map((it: string) => it.toLowerCase()) as PreviewFeatures[]
    }
  } catch (e) {}

  return undefined
}

export function getFieldsFromCurrentBlock(lines: string[], block: Block, position?: Position): string[] {
  const fieldNames: string[] = []
  let reachedStartLine = false

  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.end.line) {
      break
    }
    if (!position || lineIndex !== position.line) {
      const fieldName = getFieldNameFromLine(line)
      if (fieldName) {
        fieldNames.push(fieldName)
      }
    }
  }
  return fieldNames
}

// TODO a regex for \w in first position would be better?
function getFieldNameFromLine(line: string) {
  if (line.startsWith('//') || line.startsWith('@@')) {
    return undefined
  }

  const firstPartOfLine = line.replace(/ .*/, '')

  return firstPartOfLine
}

export function getFieldTypesFromCurrentBlock(lines: string[], block: Block, position?: Position) {
  const fieldTypes = new Map<string, { lineIndexes: number[]; fieldName: string | undefined }>()
  const fieldTypeNames: Record<string, string> = {}

  let reachedStartLine = false
  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.end.line) {
      break
    }
    if (!line.startsWith('@@') && (!position || lineIndex !== position.line)) {
      const fieldType = getFieldType(line)

      if (fieldType !== undefined) {
        const existingFieldType = fieldTypes.get(fieldType)
        if (!existingFieldType) {
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
  const compositeTypeFieldName = compositeTypeFieldNames.shift()!
  const fieldTypeNames = fieldTypesFromBlock.fieldTypeNames
  const fieldTypeName = fieldTypeNames[compositeTypeFieldName]

  if (!fieldTypeName) {
    return []
  }

  const typeBlock = getModelOrTypeOrEnumBlock(fieldTypeName, lines)
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
