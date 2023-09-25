import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'
import { convertToCompletionItems } from './internals'

import * as completions from './completions.json'
import { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'

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

export const nativeTypeCompletion = (items: CompletionItem[], element: NativeTypeConstructors) =>
  items.push({
    label: element.name,
    kind: CompletionItemKind.TypeParameter,
  })

export const relationSingleTypeCompletion = (items: CompletionItem[], sugg: CompletionItem) =>
  items.push({
    label: `${sugg.label}?`,
    kind: sugg.kind,
    documentation: sugg.documentation,
  })

export const relationManyTypeCompletion = (items: CompletionItem[], sugg: CompletionItem) =>
  items.push({
    label: `${sugg.label}[]`,
    kind: sugg.kind,
    documentation: sugg.documentation,
  })
