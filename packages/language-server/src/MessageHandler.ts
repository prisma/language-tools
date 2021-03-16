import {
  DocumentFormattingParams,
  TextEdit,
  Range,
  Location,
  DeclarationParams,
  CompletionParams,
  CompletionList,
  CompletionItem,
  Position,
  HoverParams,
  Hover,
  CodeActionParams,
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  RenameParams,
  WorkspaceEdit,
} from 'vscode-languageserver'
import { fullDocumentRange } from './provider'
import { TextDocument } from 'vscode-languageserver-textdocument'
import format from './prisma-fmt/format'
import {
  getSuggestionForFieldAttribute,
  getSuggestionsForTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideAttributes,
  positionIsAfterFieldAndType,
  isInsideAttribute,
  getSymbolBeforePosition,
  suggestEqualSymbol,
  getSuggestionForNativeTypes,
} from './completion/completions'
import { quickFix } from './codeActionProvider'
import lint from './prisma-fmt/lint'
import {
  isModelName,
  insertBasicRename,
  renameReferencesForModelName,
  isEnumValue,
  renameReferencesForEnumValue,
  isValidFieldName,
  extractCurrentName,
  mapExistsAlready,
  insertMapAttribute,
  renameReferencesForFieldValue,
  isEnumName,
  printLogMessage,
  isRelationField,
} from './rename/renameUtil'
import {
  checkForExperimentalFeaturesUSeage,
  checkForPrisma1Model,
  greyOutIgnoredFields,
  transformLinterErrorsToDiagnostics,
} from './diagnosticsHandler'
import { doc } from 'prettier'

export function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: Number.MAX_SAFE_INTEGER },
  })
}

export function convertDocumentTextToTrimmedLineArray(
  document: TextDocument,
): Array<string> {
  return Array(document.lineCount)
    .fill(0)
    .map((_, i) => getCurrentLine(document, i).trim())
}

function isFirstInsideBlock(position: Position, currentLine: string): boolean {
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

export function getWordAtPosition(
  document: TextDocument,
  position: Position,
): string {
  const currentLine = getCurrentLine(document, position.line)

  // search for the word's beginning and end
  const beginning: number = currentLine
    .slice(0, position.character + 1)
    .search(/\S+$/)
  const end: number = currentLine.slice(position.character).search(/\W/)
  if (end < 0) {
    return ''
  }
  return currentLine.slice(beginning, end + position.character)
}

export class Block {
  type: string
  start: Position
  end: Position
  name: string

  constructor(type: string, start: Position, end: Position, name: string) {
    this.type = type
    this.start = start
    this.end = end
    this.name = name
  }
}

export function getBlockAtPosition(
  line: number,
  lines: Array<string>,
): Block | void {
  let blockType = ''
  let blockName = ''
  let blockStart: Position = Position.create(0, 0)
  let blockEnd: Position = Position.create(0, 0)
  const allowedBlockIdentifiers = ['model', 'enum', 'datasource', 'generator']

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
    if (
      allowedBlockIdentifiers.some((identifier) =>
        item.startsWith(identifier),
      ) &&
      item.includes('{')
    ) {
      const index = item.search(/\s+/)
      blockType = ~index ? item.slice(0, index) : item
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
    if (item.startsWith('}')) {
      blockEnd = Position.create(key, 1)
      return new Block(blockType, blockStart, blockEnd, blockName)
    }
  }
  return
}

export function getModelOrEnumBlock(
  blockName: string,
  lines: string[],
): Block | void {
  // get start position of model type
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(blockName)) ||
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

export async function handleDiagnosticsRequest(
  document: TextDocument,
  binPath: string,
  onError?: (errorMessage: string) => void,
): Promise<Diagnostic[]> {
  const text = document.getText(fullDocumentRange(document))
  const res = await lint(binPath, text, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (checkForPrisma1Model(res)) {
    if (onError) {
      onError(
        "You are currently viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma Language Server doesn't support this syntax. Please change the file extension to `.graphql` so the Prisma Language Server does not get triggered anymore.",
      )
    }
  }

  const diagnostics: Diagnostic[] = transformLinterErrorsToDiagnostics(
    res,
    document,
  )

  // check for experimentalFeatures inside generator block
  const experimentalFeaturesUsage = checkForExperimentalFeaturesUSeage(document)
  if (experimentalFeaturesUsage) {
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range: experimentalFeaturesUsage,
      message:
        "This property has been renamed to 'previewFeatures' to better communicate what they are.",
      source: '',
    })
  }

  diagnostics.concat(greyOutIgnoredFields(document))

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(
  document: TextDocument,
  params: DeclarationParams,
): Location | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  // get start position of model type
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(word)) ||
        (line.includes('enum') && line.includes(word))
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
      if (block && block.name === word) {
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

  const startPosition = {
    line: foundBlocks[0].start.line,
    character: foundBlocks[0].start.character,
  }
  const endPosition = {
    line: foundBlocks[0].end.line,
    character: foundBlocks[0].end.character,
  }

  return {
    uri: textDocument.uri,
    range: Range.create(startPosition, endPosition),
  }
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export async function handleDocumentFormatting(
  params: DocumentFormattingParams,
  document: TextDocument,
  binPath: string,
  onError?: (errorMessage: string) => void,
): Promise<TextEdit[]> {
  const options = params.options

  return format(
    binPath,
    options.tabSize,
    document.getText(),
    onError,
  ).then((formatted) => [
    TextEdit.replace(fullDocumentRange(document), formatted),
  ])
}

export function handleHoverRequest(
  document: TextDocument,
  params: HoverParams,
): Hover | undefined {
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrEnumBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const commentLine = foundBlock.start.line - 1
  const docComments = document.getText({
    start: { line: commentLine, character: 0 },
    end: { line: commentLine, character: Number.MAX_SAFE_INTEGER },
  })
  if (docComments.startsWith('///')) {
    return {
      contents: docComments.slice(4).trim(),
    }
  }
  // TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
  /*if (docComments.startsWith('//')) {
    return {
      contents: docComments.slice(3).trim(),
    }
  } */

  return
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  params: CompletionParams,
  document: TextDocument,
  binPath: string,
): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const currentLineTillPosition = currentLineUntrimmed
    .slice(0, position.character - 1)
    .trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforePositionIsWhiteSpace =
    symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 &&
    !currentLineTillPosition.includes('[') &&
    symbolBeforePositionIsWhiteSpace

  const foundBlock = getBlockAtPosition(position.line, lines)
  if (!foundBlock) {
    if (
      wordsBeforePosition.length > 1 ||
      (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)
    ) {
      return
    }
    return getSuggestionForBlockTypes(lines)
  }

  if (isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
    return getSuggestionForFirstInsideBlock(
      foundBlock.type,
      lines,
      position,
      foundBlock,
    )
  }

  // Completion was triggered by a triggerCharacter
  if (context?.triggerKind === 2) {
    switch (context.triggerCharacter) {
      case '@':
        if (
          !positionIsAfterFieldAndType(position, document, wordsBeforePosition)
        ) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(document, position.line),
          lines,
          wordsBeforePosition,
          document,
          binPath,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          binPath,
        )
      case '.':
        return getSuggestionForNativeTypes(
          foundBlock,
          wordsBeforePosition,
          document,
          binPath,
          lines,
        )
    }
  }

  switch (foundBlock.type) {
    case 'model':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideAttributes(
          currentLineUntrimmed,
          lines,
          position,
          foundBlock,
        )
      }

      // check if type
      if (
        !positionIsAfterFieldAndType(position, document, wordsBeforePosition)
      ) {
        return getSuggestionsForTypes(
          foundBlock,
          lines,
          position,
          currentLineUntrimmed,
        )
      }
      return getSuggestionForFieldAttribute(
        foundBlock,
        lines[position.line],
        lines,
        wordsBeforePosition,
        document,
        binPath,
      )
    case 'datasource':
    case 'generator':
      if (
        wordsBeforePosition.length === 1 &&
        symbolBeforePositionIsWhiteSpace
      ) {
        return suggestEqualSymbol(foundBlock.type)
      }
      if (
        currentLineTillPosition.includes('=') &&
        !currentLineTillPosition.includes(']') &&
        !positionIsAfterArray &&
        symbolBeforePosition !== ','
      ) {
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          binPath,
        )
      }
      break
    case 'enum':
      break
  }
}

export function handleRenameRequest(
  params: RenameParams,
  document: TextDocument,
): WorkspaceEdit | undefined {
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  const position = params.position
  const currentLine: string = lines[position.line]
  const currentBlock = getBlockAtPosition(position.line, lines)
  const edits: TextEdit[] = []
  if (!currentBlock) {
    return
  }

  const isModelRename: boolean = isModelName(
    params.position,
    currentBlock,
    lines,
    document,
  )
  const isEnumRename: boolean = isEnumName(
    params.position,
    currentBlock,
    lines,
    document,
  )
  const isEnumValueRename: boolean = isEnumValue(
    currentLine,
    params.position,
    currentBlock,
    document,
  )
  const isValidFieldRename: boolean = isValidFieldName(
    currentLine,
    params.position,
    currentBlock,
    document,
  )
  const isRelationFieldRename: boolean =
    isValidFieldRename && isRelationField(currentLine, lines)

  if (
    isModelRename ||
    isEnumRename ||
    isEnumValueRename ||
    isValidFieldRename
  ) {
    const currentName = extractCurrentName(
      currentLine,
      isModelRename || isEnumRename,
      isEnumValueRename,
      isValidFieldRename,
      document,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = currentBlock
    let lineOfDefinition = currentLine
    if (isModelRename || isEnumRename) {
      // get definition of model or enum
      const matchModelOrEnumBlockBeginning = new RegExp(
        `\\s*(model|enum)\\s+(${currentName})\\s*({)`,
        'g',
      )
      lineNumberOfDefinition = lines.findIndex((l) =>
        matchModelOrEnumBlockBeginning.test(l),
      )
      if (lineNumberOfDefinition === -1) {
        return
      }
      lineOfDefinition = lines[lineNumberOfDefinition]
      const definitionBlockAtPosition = getBlockAtPosition(
        lineNumberOfDefinition,
        lines,
      )
      if (!definitionBlockAtPosition) {
        return
      }
      blockOfDefinition = definitionBlockAtPosition
    }

    // rename marked string
    edits.push(
      insertBasicRename(
        params.newName,
        currentName,
        document,
        lineNumberOfDefinition,
      ),
    )

    // check if map exists already
    if (
      !isRelationFieldRename &&
      !mapExistsAlready(
        lineOfDefinition,
        lines,
        blockOfDefinition,
        isModelRename || isEnumRename,
      )
    ) {
      // add map attribute
      edits.push(
        insertMapAttribute(
          currentName,
          position,
          blockOfDefinition,
          isModelRename || isEnumRename,
        ),
      )
    }

    // rename references
    if (isModelRename || isEnumRename) {
      edits.push(
        ...renameReferencesForModelName(
          currentName,
          params.newName,
          document,
          lines,
        ),
      )
    } else if (isEnumValueRename) {
      edits.push(
        ...renameReferencesForEnumValue(
          currentName,
          params.newName,
          document,
          lines,
          blockOfDefinition.name,
        ),
      )
    } else if (isValidFieldRename) {
      edits.push(
        ...renameReferencesForFieldValue(
          currentName,
          params.newName,
          document,
          lines,
          blockOfDefinition,
          isRelationFieldRename,
        ),
      )
    }

    printLogMessage(
      currentName,
      params.newName,
      isEnumRename,
      isModelRename,
      isValidFieldRename,
      isEnumValueRename,
    )
    return {
      changes: {
        [document.uri]: edits,
      },
    }
  }

  return
}

/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
export function handleCompletionResolveRequest(
  item: CompletionItem,
): CompletionItem {
  return item
}

export function handleCodeActions(
  params: CodeActionParams,
  document: TextDocument,
): CodeAction[] {
  if (!params.context.diagnostics.length) {
    return []
  }

  return quickFix(document, params)
}
