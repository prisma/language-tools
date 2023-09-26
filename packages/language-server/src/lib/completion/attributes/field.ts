import { CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat } from 'vscode-languageserver'

import { convertAttributesToCompletionItems } from '../internals'

import * as completions from '../completions.json'
import { Block, getFieldType, getFirstDatasourceName, getDataBlock } from '../../ast'
import { filterSuggestionsForLine, filterSuggestionsForBlock } from '../completionUtils'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getNativeTypes } from '../types'

export const fieldAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.fieldAttributes,
  CompletionItemKind.Property,
)

const dataSourceNameCompletion = (items: CompletionItem[], datasourceName: string) =>
  items.push({
    // https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions
    kind: CompletionItemKind.Property,
    label: '@' + datasourceName,
    documentation:
      'Defines a native database type that should be used for this field. See https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#native-types-mapping',
    insertText: `@${datasourceName}$0`,
    insertTextFormat: InsertTextFormat.Snippet,
  })

/**
 * Should suggest all field attributes for a given field
 * EX: id Int |> @id, @default, @datasourceName, ...etc
 *
 * If `@datasourceName.` |> suggests nativeTypes
 * @param block
 * @param currentLine
 * @param lines
 * @param wordsBeforePosition
 * @param document
 * @returns
 */
export function getSuggestionForFieldAttribute(
  block: Block,
  currentLine: string,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const fieldType = getFieldType(currentLine)
  // If we don't find a field type (e.g. String, Int...), return no suggestion
  if (!fieldType) {
    return
  }

  let suggestions: CompletionItem[] = []

  // Because @.?
  if (wordsBeforePosition.length >= 2) {
    const datasourceName = getFirstDatasourceName(lines)
    const prismaType = wordsBeforePosition[1]
    const nativeTypeSuggestions = getNativeTypes(document, prismaType, onError)

    if (datasourceName) {
      if (!currentLine.includes(`@${datasourceName}`)) {
        dataSourceNameCompletion(suggestions, datasourceName)
      }

      if (nativeTypeSuggestions.length !== 0) {
        if (
          // Check that we are not separated by a space like `@db. |`
          wordsBeforePosition[wordsBeforePosition.length - 1] === `@${datasourceName}`
        ) {
          suggestions.push(...nativeTypeSuggestions)
          return {
            items: suggestions,
            isIncomplete: false,
          }
        }
      }
    }
  }

  suggestions.push(...fieldAttributes)

  const modelOrTypeOrEnum = getDataBlock(fieldType, lines)

  suggestions = filterSuggestionsForLine(suggestions, currentLine, fieldType, modelOrTypeOrEnum?.type)

  suggestions = filterSuggestionsForBlock(suggestions, block, lines)

  return {
    items: suggestions,
    isIncomplete: false,
  }
}
