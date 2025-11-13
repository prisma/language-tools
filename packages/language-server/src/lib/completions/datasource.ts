import { klona } from 'klona'

import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'

import { convertToCompletionItems } from './internals'
import * as completions from './completions.json'

const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviders,
  CompletionItemKind.Constant,
)

/**
 * ```prisma
 * datasource db {
 *  provider = "|"
 * }
 * ```
 */
const dataSourceProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviderArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * datasource db {
 *  relationMode = "|"
 * }
 * ```
 */
const relationModeValues: CompletionItem[] = convertToCompletionItems(
  completions.relationModeValues,
  CompletionItemKind.Field,
)

export const dataSourceSuggestions = (
  currentLine: string,
  isInsideQuotation: boolean,
  datasourceProvider: string | undefined,
) => {
  // provider
  if (currentLine.startsWith('provider')) {
    const providers: CompletionItem[] = dataSourceProviders

    if (isInsideQuotation) {
      return {
        items: providers,
        isIncomplete: true,
      }
    } else {
      return {
        items: dataSourceProviderArguments,
        isIncomplete: true,
      }
    }
  }
  // `relationMode` can only be set for SQL databases
  else if (currentLine.startsWith('relationMode') && datasourceProvider !== 'mongodb') {
    const relationModeValuesSuggestion: CompletionItem[] = relationModeValues
    // values inside quotes `"value"`
    const relationModeValuesSuggestionWithQuotes: CompletionItem[] = klona(relationModeValuesSuggestion).map(
      (suggestion) => {
        suggestion.label = `"${suggestion.label}"`
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        suggestion.insertText = `"${suggestion.insertText!}"`
        return suggestion
      },
    )

    if (isInsideQuotation) {
      return {
        items: relationModeValuesSuggestion,
        isIncomplete: false,
      }
    }
    // If line ends with `"`, a value is already set.
    else if (!currentLine.endsWith('"')) {
      return {
        items: relationModeValuesSuggestionWithQuotes,
        isIncomplete: false,
      }
    }
  }
}
