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
} from 'vscode-languageserver'
import * as util from './util'
import { fullDocumentRange } from './provider'
import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import format from './format'
import {
  getSuggestionsForAttributes,
  getSuggestionsForTypes,
} from './completions'
import { Schema } from 'prismafile/dist/ast'

function getWordAtPosition(document: TextDocument, position: Position): string {
  const currentLine = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line, character: 9999 },
  })

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

/**
 * 
 * @todo what happens with @default(autoincrement()) when at position inside autoincrement()?
 */
function getWordAtPositionTest(ast: Schema, position: Position) {
  const foundBlock = ast.blocks.find(node =>
    node.start.line - 1 <= position.line
    && node.end.line - 1 >= position.line
  )
  if (!foundBlock) {
    return ''
  }

  // this only works on formatted files!
  if (foundBlock.start.line - 1 === position.line) {
    // do something here 
    if (foundBlock.type.length >= position.character) {
      return foundBlock.type
    }
    if (position.character <= foundBlock.type.length + 1 + foundBlock.name.length) {
      return foundBlock.name
    }
    return ''
  }

  switch (foundBlock.type) {
    case "datasource":
    case "generator":
      let foundAssignment = foundBlock.assignments.find(node =>
        node.start.line - 1 <= position.line
        && node.end.line - 1 >= position.line
        && node.start.column - 1 <= position.character
        && node.end.column - 1 >= position.character)
      if (!foundAssignment) {
        break
      }
      if (position.character <= foundAssignment.start.column - 1 + foundAssignment.key.length) {
        return foundAssignment.key
      }
      if (position.character >= foundAssignment.value.start.column - 1) {
        return foundAssignment.value
      }
      break
    case "model":
      let foundProperty = foundBlock.properties.find(node =>
        node.start.line - 1 <= position.line
        && node.end.line - 1 >= position.line
        && node.start.column - 1 <= position.character
        && node.end.column - 1 >= position.character)
      if(!foundProperty) {
        break;
      }
      if(position.character <= foundProperty.start.column - 1 + foundProperty.name.length) {
        return foundProperty.name
      }
      // TODO get datatype, attributes, e.g. @id, Int
      break
    case "enum":
      let foundAttribute = foundBlock.attributes.find(node =>
        node.start.line - 1 <= position.line
        && node.end.line - 1 >= position.line)
      let foundEnumerator = foundBlock.enumerators.find(node =>
        node.start.line - 1 <= position.line
        && node.end.line - 1 >= position.line)
      break
    case "type_alias":
      let foundAlias = foundBlock.attributes.find(node =>
        node.start.line - 1 <= position.line
        && node.end.line - 1 >= position.line)
      break
  }
  return ''
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export async function handleDefinitionRequest(
  documents: TextDocuments<TextDocument>,
  params: DeclarationParams,
): Promise<Location> {
  const textDocument = params.textDocument
  const position = params.position

  const document = documents.get(textDocument.uri)

  if (!document) {
    return new Promise((resolve) => resolve())
  }

  const documentText = document.getText()
  // parse schema file to AST node
  const ast = parse(documentText)

  const word = getWordAtPosition(document, position)
  const testWord = getWordAtPositionTest(ast, position)

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

  const documentText = document.getText()
  const token = getWordAtPosition(document, params.position)

  // Completion was triggered by a triggerCharacter
  if (context.triggerKind === 2) {
    switch (context.triggerCharacter) {
      // get suggestions for directives
      case '@':
        return getSuggestionsForAttributes(token)
    }
  }

  // TODO check if in model block
  const completionList = getSuggestionsForTypes()

  // TODO get position in AST Node to know what the context is here (e.g. type, model, field or directive position)

  return completionList
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
