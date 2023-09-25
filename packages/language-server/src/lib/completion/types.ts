import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'
import { convertToCompletionItems } from './internals'

import * as completions from './completions.json'

/**
 * ```prisma
 * model A {
 *  field |
 * }
 * ```
 */
export const corePrimitiveTypes: CompletionItem[] = convertToCompletionItems(
  completions.primitiveTypes,
  CompletionItemKind.TypeParameter,
)
