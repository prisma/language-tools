import {
  TextDocuments,
  DocumentFormattingParams,
  TextEdit,
  Range,
  Location,
  DeclarationParams,
  CompletionParams,
  CompletionList,
  CompletionItem,
  Position,
} from 'vscode-languageserver'
import * as util from './util'
import { fullDocumentRange } from './provider'
import { TextDocument } from 'vscode-languageserver-textdocument'
import format from './format'
import {
  getSuggestionsForAttributes,
  getSuggestionsForTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideAttributes,
} from './completions'

export function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: 9999 },
  })
}

function convertDocumentTextToTrimmedLineArray(
  document: TextDocument,
): Array<string> {
  return [...Array(document.lineCount)].map((_, i) =>
    getCurrentLine(document, i).trim(),
  )
}

function isFirstInsideBlock(
  position: Position,
  document: TextDocument,
): boolean {
  const currentLine = getCurrentLine(document, position.line)
  if (currentLine.trim().length === 0) {
    return true
  }

  const stringTillPosition = currentLine.slice(0, position.character).trim()
  const i = stringTillPosition.search(/\s+/)
  const firstWordInLine = ~i
    ? stringTillPosition.slice(0, i)
    : stringTillPosition

  return stringTillPosition.length === firstWordInLine.length
}

function getWordAtPosition(currentLine: string, position: Position): string {
  if (currentLine.slice(0, position.character).endsWith('@@')) {
    return '@@'
  }
  // search for the word's beginning and end
  const beginning = currentLine.slice(0, position.character + 1).search(/\S+$/)
  const end = currentLine.slice(position.character).search(/\W/)
  if (end < 0) {
    return ''
  }
  return currentLine.slice(beginning, end + position.character)
}

export class MyBlock {
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

function getBlockAtPosition(
  line: number,
  lines: Array<string>,
): MyBlock | void {
  let blockType = ''
  let blockName = ''
  let blockStart: Position = Position.create(0, 0)
  let blockEnd: Position = Position.create(0, 0)
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
    if (item.includes('{')) {
      const index = item.search(/\s+/)
      blockType = ~index ? item.slice(0, index) : item
      blockName = item.slice(blockType.length, item.length - 2).trim()
      blockStart = Position.create(actualIndex, 0)
      break
    }
    // not inside a block
    if (item.includes('}')) {
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
    if (item.includes('}')) {
      blockEnd = Position.create(key, 1)
      return new MyBlock(blockType, blockStart, blockEnd, blockName)
    }
  }
  return
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(
  documents: TextDocuments<TextDocument>,
  params: DeclarationParams,
): Location | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const document = documents.get(textDocument.uri)

  if (!document) {
    return
  }

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(lines[position.line], position)

  if (word === '') {
    return
  }

  const documentText = document.getText()

  // get start position of model type
  const index = documentText.search(new RegExp('model\\s+' + word + '[\\s|{]'))

  const modelBlock = getBlockAtPosition(document.positionAt(index).line, lines)

  if (!modelBlock) {
    return
  }

  const startPosition = {
    line: modelBlock?.start.line,
    character: modelBlock?.start.character,
  }
  const endPosition = {
    line: modelBlock?.end.line,
    character: modelBlock?.end.character,
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
  documents: TextDocuments<TextDocument>,
  onError?: (errorMessage: string) => void,
): Promise<TextEdit[]> {
  const options = params.options
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return []
  }
  const binPath = await util.getBinPath()
  return format(
    binPath,
    options.tabSize,
    document.getText(),
    onError,
  ).then((formatted) => [
    TextEdit.replace(fullDocumentRange(document), formatted),
  ])
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  params: CompletionParams,
  documents: TextDocuments<TextDocument>,
): CompletionList | undefined {
  const context = params.context
  if (!context) {
    return
  }

  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return
  }
  const lines = convertDocumentTextToTrimmedLineArray(document)

  const foundBlock = getBlockAtPosition(params.position.line, lines)
  if (!foundBlock) {
    return getSuggestionForBlockTypes(document)
  }

  if (isFirstInsideBlock(params.position, document)) {
    return getSuggestionForFirstInsideBlock(
      foundBlock.type,
      document,
      params.position,
      foundBlock,
    )
  }

  // Completion was triggered by a triggerCharacter
  if (context.triggerKind === 2) {
    switch (context.triggerCharacter) {
      case '@':
        return getSuggestionsForAttributes(
          foundBlock.type,
          params.position,
          document,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          document,
          params.position,
        )
    }
  }

  if (foundBlock.type === 'model') {
    const symbolBeforePosition = document.getText({
      start: {
        line: params.position.line,
        character: params.position.character - 1,
      },
      end: { line: params.position.line, character: params.position.character },
    })
    const currentLine = getCurrentLine(document, params.position.line).trim()
    const wordsBeforePosition: string[] = currentLine
      .slice(0, params.position.character - 1)
      .trim()
      .split(/\s+/)

    if (currentLine.includes('(')) {
      return getSuggestionsForInsideAttributes(
        document,
        params.position,
        foundBlock,
      )
    }

    // check if type
    if (
      wordsBeforePosition.length < 2 ||
      (wordsBeforePosition.length === 2 && symbolBeforePosition !== ' ')
    ) {
      return getSuggestionsForTypes(foundBlock, document)
    }
    return getSuggestionsForAttributes(
      foundBlock.type,
      params.position,
      document,
    )
  }
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
