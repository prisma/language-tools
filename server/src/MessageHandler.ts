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
  getSuggestionForField,
  getSuggestionsForRelation,
} from './completions'
import { parse } from 'prismafile'
import { Schema, Block } from 'prismafile/dist/ast'
import { stringify } from 'querystring'
import { SyntaxError } from 'prismafile/dist/parser/index'

export function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: 9999 },
  })
}

function isFieldName(
  position: Position,
  document: TextDocument,
  invalidSchema: boolean,
): boolean {
  const currentLine = getCurrentLine(document, position.line)
  if (currentLine.trim().length === 0) {
    return true
  }

  const stringTillPosition = currentLine.substring(0, position.character).trim()
  const firstWordInLine = stringTillPosition.replace(/ .*/, '')

  return stringTillPosition.length === firstWordInLine.length
}

function getWordAtPosition(document: TextDocument, position: Position): string {
  const currentLine = getCurrentLine(document, position.line)

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
  ast?: Schema,
  document?: TextDocument,
): Block | MyBlock | undefined {
  // valid schema
  if (ast) {
    const foundBlock = ast.blocks.find(
      (node) => node.start.line - 1 <= line && node.end.line - 1 >= line,
    )
    return !foundBlock ? undefined : foundBlock
  }
  // invalid schema
  if (document) {
    let blockType = ''
    let blockName = ''
    let blockStart: Position = Position.create(0, 0)
    let blockEnd: Position = Position.create(0, 0)
    // get block beginning
    for (let _i = line; _i >= 0; _i--) {
      const currentLine = getCurrentLine(document, _i).trim()
      if (currentLine.includes('{')) {
        // position is inside a block
        blockType = currentLine.replace(/ .*/, '')
        blockName = currentLine
          .substring(blockType.length, currentLine.length - 2)
          .trim()
        blockStart = Position.create(_i, 0)
        break
      }
      // not inside a block
      if (currentLine.includes('}') || _i === 0) {
        return undefined
      }
    }
    // get block ending
    for (let _j = line; _j < document.lineCount; _j++) {
      const currentLine = getCurrentLine(document, _j).trim()
      if (currentLine.includes('}')) {
        blockEnd = Position.create(_j, 1)
        return {
          start: blockStart,
          name: blockName,
          end: blockEnd,
          type: blockType,
        }
      }
    }
  }
  return undefined
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export async function handleDefinitionRequest(
  documents: TextDocuments<TextDocument>,
  params: DeclarationParams,
  ast: Schema,
): Promise<Location> {
  const textDocument = params.textDocument
  const position = params.position

  const document = documents.get(textDocument.uri)

  if (!document) {
    return new Promise((resolve) => resolve())
  }

  const word = getWordAtPosition(document, position)

  if (word === '') {
    return new Promise((resolve) => resolve())
  }

  const found = ast.blocks.find(
    (b) => b.type === 'model' && b.name.name === word,
  )

  // selected word is not a model type
  if (!found) {
    return new Promise((resolve) => resolve())
  }

  const startPosition = {
    line: found.start.line - 1,
    character: found.start.column - 1,
  }
  const endPosition = {
    line: found.end.line,
    character: found.end.column,
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
  if (context == null) {
    return undefined
  }

  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return undefined
  }
  const documentText = document.getText()

  let ast: Schema | undefined
  let invalidSchema = false
  try {
    ast = parse(documentText)
  } catch (errors) {
    if (errors instanceof SyntaxError) {
      invalidSchema = true
      console.log('Error message: ' + errors.message)
      console.log('Error name: ' + errors.name)
    }
  }

  const foundBlock = getBlockAtPosition(params.position.line, ast, document)
  if (!foundBlock) {
    return getSuggestionForBlockTypes(ast, document)
  }

  if (isFieldName(params.position, document, invalidSchema)) {
    return getSuggestionForField(
      foundBlock.type,
      document,
      params.position,
      ast,
      foundBlock,
    )
  }

  // Completion was triggered by a triggerCharacter
  if (context.triggerKind === 2) {
    switch (context.triggerCharacter) {
      case '@':
        return getSuggestionsForAttributes(foundBlock.type)
      case ':':
        return getSuggestionsForRelation(
          foundBlock.type,
          document,
          params.position,
        )
    }
  }

  if (foundBlock.type === 'model') {
    //return getSuggestionsForTypes(ast, foundBlock)
  }
}

interface ExpectedObject {
  text: string
  type: string
  ignoreCase: boolean
}

interface DocumentLocation {
  start: { line: number; column: number; offset: number }
  end: { line: number; column: number; offset: number }
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
