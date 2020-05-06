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
  CompletionItemKind,
} from 'vscode-languageserver'
import * as util from './util'
import { fullDocumentRange } from './provider'
import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import format from './format'
import {
  getSuggestionsForAttributes,
  getSuggestionsForTypes,
  getSuggestionForBlockTypes,
  getSuggestionForField,
  getSuggestionsForRelation,
} from './completions'
import { parse } from 'prismafile'
import { SyntaxError } from 'prismafile/dist/parser/index'
import { Schema, Block } from 'prismafile/dist/ast'
import { stringify } from 'querystring'

function getCurrentLine(document: TextDocument, line: number): string {
  return document.getText({
    start: { line: line, character: 0 },
    end: { line: line, character: 9999 },
  })
}

function isFieldName(
  position: Position,
  token: string,
  document: TextDocument,
): boolean {
  const currentLine = getCurrentLine(document, position.line)
  if (token === '') {
    return currentLine.trim().length === 0
  }
  return currentLine.trim().startsWith(token)
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

function getBlockAtPosition(
  ast: Schema,
  position: Position,
): Block | undefined {
  const foundBlock = ast.blocks.find(
    (node) =>
      node.start.line - 1 <= position.line &&
      node.end.line - 1 >= position.line,
  )
  return !foundBlock ? undefined : foundBlock
}

function isInsideBlock(block: Block, position: Position): boolean {
  return position.line != block.start.line - 1
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

  const documentText = document.getText()

  const word = getWordAtPosition(document, position)

  if (word === '') {
    return new Promise((resolve) => resolve())
  }

  const found = ast.blocks.find((b) => b.type === 'model' && b.name === word)

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

  let ast: Schema | undefined
  let error: SyntaxError | undefined
  try {
    ast = parse(document.getText())

    // no syntax error
    if (ast) {
      const foundBlock = getBlockAtPosition(ast, params.position)
      if (!foundBlock) {
        return getSuggestionForBlockTypes(ast)
      }

      const token = getWordAtPosition(document, params.position)

      // Completion was triggered by a triggerCharacter
      if (context.triggerKind === 2) {
        switch (context.triggerCharacter) {
          case '@':
            return getSuggestionsForAttributes(token, foundBlock)
          case '[':
            return getSuggestionsForRelation(
              foundBlock,
              getCurrentLine(document, params.position.line),
            )
        }
      }

      // check if suggestion for field name or type!
      if (isFieldName(params.position, token, document)) {
        return getSuggestionForField(ast, foundBlock)
      }

      if (foundBlock.type === 'model') {
        // check if inside directive

        return getSuggestionsForTypes(ast, foundBlock)
      }
    }
  } catch (errors) {
    if (errors instanceof SyntaxError) {
      error = errors

      const found: string = errors.found
      const expected: Array<ExpectedObject> = errors.expected
      const message: string = errors.message
      const location: LocationError = errors.location
      const name: string = errors.name

      console.warn(
        'expected: ' + expected.forEach((object) => console.log(object.text)),
      )
      console.warn('found: ' + found) // does not work with '@' right now
      console.warn('location: ' + location)
      console.warn('message: ' + message)
      console.warn('name: ' + name)

      const items: CompletionItem[] = []
      expected.forEach((suggestions) => suggestions.text != 'undefined')
      expected.forEach((type) =>
        items.push({
          label: type.text,
          kind: CompletionItemKind.TypeParameter,
        }),
      )

      return {
        items: items,
        isIncomplete: false,
      }
    }
  }
}

interface ExpectedObject {
  text: string
  type: string
  ignoreCase: boolean
}

interface LocationError {
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
