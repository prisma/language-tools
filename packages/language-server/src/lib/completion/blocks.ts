import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'
import { convertToCompletionItems } from './completionUtils'

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
