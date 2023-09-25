import { CompletionParams, CompletionList, CompletionTriggerKind } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import textDocumentCompletion from '../prisma-schema-wasm/textDocumentCompletion'

import {
  fullDocumentRange,
  convertDocumentTextToTrimmedLineArray,
  getCurrentLine,
  getSymbolBeforePosition,
  getBlockAtPosition,
  isFirstInsideBlock,
  positionIsAfterFieldAndType,
  isInsideAttribute,
} from '../ast'
import {
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForFieldAttribute,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideRoundBrackets,
  getSuggestionForNativeTypes,
  getSuggestionsForFieldTypes,
  suggestEqualSymbol,
} from './completions'

export * from './blocks'
export * from './datasource'
export * from './generator'

export function prismaSchemaWasmCompletions(
  params: CompletionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const text = document.getText(fullDocumentRange(document))

  const completionList = textDocumentCompletion(text, params, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (completionList.items.length === 0) {
    return undefined
  } else {
    return completionList
  }
}

export function localCompletions(
  params: CompletionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const currentLineTillPosition = currentLineUntrimmed.slice(0, position.character - 1).trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforePositionIsWhiteSpace = symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 && !currentLineTillPosition.includes('[') && symbolBeforePositionIsWhiteSpace

  // datasource, generator, model, type or enum
  const foundBlock = getBlockAtPosition(position.line, lines)
  if (!foundBlock) {
    if (wordsBeforePosition.length > 1 || (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)) {
      return
    }
    return getSuggestionForBlockTypes(lines)
  }

  if (isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
    return getSuggestionForFirstInsideBlock(foundBlock.type, lines, position, foundBlock)
  }

  // Completion was triggered by a triggerCharacter
  // triggerCharacters defined in src/server.ts
  if (context?.triggerKind === CompletionTriggerKind.TriggerCharacter) {
    switch (context.triggerCharacter as '@' | '"' | '.') {
      case '@':
        if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(document, position.line),
          lines,
          wordsBeforePosition,
          document,
          onError,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          lines,
          onError,
        )
      case '.':
        // check if inside attribute
        // Useful to complete composite types
        if (['model', 'view'].includes(foundBlock.type) && isInsideAttribute(currentLineUntrimmed, position, '()')) {
          return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, position, foundBlock)
        } else {
          return getSuggestionForNativeTypes(foundBlock, lines, wordsBeforePosition, document, onError)
        }
    }
  }

  switch (foundBlock.type) {
    case 'model':
    case 'view':
    case 'type':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, position, foundBlock)
      }
      // check if field type
      if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
        return getSuggestionsForFieldTypes(foundBlock, lines, position, currentLineUntrimmed)
      }
      return getSuggestionForFieldAttribute(
        foundBlock,
        lines[position.line],
        lines,
        wordsBeforePosition,
        document,
        onError,
      )
    case 'datasource':
    case 'generator':
      if (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace) {
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
          lines,
          onError,
        )
      }
      break
    case 'enum':
      break
  }
}
