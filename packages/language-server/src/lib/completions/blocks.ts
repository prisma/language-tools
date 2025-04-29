import { CompletionItem, CompletionItemKind, CompletionList } from 'vscode-languageserver'
import { klona } from 'klona'

import { convertToCompletionItems } from './internals'

import * as completions from './completions.json'
import { getAllPreviewFeaturesFromGenerators, getFirstDatasourceProvider } from '../ast'
import { PrismaSchema } from '../Schema'

/**
 * ```
 * schema.prisma """
 *  |
 * """
 * ```
 */
const allowedBlockTypes: CompletionItem[] = convertToCompletionItems(completions.blockTypes, CompletionItemKind.Class)

/**
 * Returns the currently available _blocks_ for completion.
 * Currently available: Generator, Datasource, Model, Enum, View
 * @param lines
 * @returns the list of block suggestions
 */
export function getSuggestionForBlockTypes(schema: PrismaSchema): CompletionList {
  // create deep copy
  let suggestions: CompletionItem[] = klona(allowedBlockTypes)

  const datasourceProvider = getFirstDatasourceProvider(schema)
  const previewFeatures = getAllPreviewFeaturesFromGenerators(schema)

  const isEnumAvailable = Boolean(!datasourceProvider?.includes('sqlite'))

  const isViewAvailable = Boolean(previewFeatures?.includes('views'))

  const isTypeAvailable = Boolean(datasourceProvider?.includes('mongodb'))

  if (!isEnumAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'enum')
  }

  if (!isViewAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'view')
  }

  if (!isTypeAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'type')
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}
