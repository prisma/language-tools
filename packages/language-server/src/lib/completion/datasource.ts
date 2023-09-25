import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'

import { convertToCompletionItems } from './internals'
import * as completions from './completions.json'

export const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
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
export const dataSourceProviderArguments: CompletionItem[] = convertToCompletionItems(
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
export const relationModeValues: CompletionItem[] = convertToCompletionItems(
  completions.relationModeValues,
  CompletionItemKind.Field,
)
