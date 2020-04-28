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
import { getDMMF } from '@prisma/sdk'
import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import format from './format'
import {
  getSuggestionsForAttributes,
  getSuggestionsForTypes,
} from './completions'

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

export async function handleDefinitionRequest(
  documents: TextDocuments<TextDocument>,
  params: DeclarationParams,
): Promise<Location> {
  // TODO: Replace bad workaround as soon as ASTNode is available

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

  // parse schema file to datamodel meta format (DMMF)
  const dmmf = await getDMMF({ datamodel: documentText })

  const modelName = dmmf.datamodel.models
    .map((model) => model.name)
    ?.find((name) => name === word)

  // selected word is not a model type

  if (!modelName) {
    return new Promise((resolve) => resolve())
  }

  const modelDefinition = 'model '
  // get start position of model type
  const index = documentText.indexOf(modelDefinition + modelName)
  const buf = documentText.slice(0, index)
  const EOL = '\n'
  const lines = buf.split(EOL).length - 1
  const lastLineIndex = buf.lastIndexOf(EOL)
  const startPosition = {
    line: lines,
    character: index + modelDefinition.length - lastLineIndex - 1,
  }
  const endPosition = {
    line: lines,
    character:
      index + modelDefinition.length - lastLineIndex - 1 + modelName.length,
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
