import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'
import { convertToCompletionItems } from './internals'

import * as completions from './completions.json'

/**
 * ```
 * schema.prisma """
 *  |
 * """
 * ```
 */
export const allowedBlockTypes: CompletionItem[] = convertToCompletionItems(
  completions.blockTypes,
  CompletionItemKind.Class,
)
