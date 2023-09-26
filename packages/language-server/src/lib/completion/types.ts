import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'
import { buildDocumentation, convertToCompletionItems } from './internals'

import * as completions from './completions.json'
import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { nativeFunctionCompletion } from './functions'

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

export function getNativeTypes(
  document: TextDocument,
  prismaType: string,
  onError?: (errorMessage: string) => void,
): CompletionItem[] {
  let nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(document.getText(), (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (nativeTypes.length === 0) {
    console.log('Did not receive any native type suggestions from prisma-schema-wasm call.')
    return []
  }

  const suggestions: CompletionItem[] = []
  nativeTypes = nativeTypes.filter((n) => n.prisma_types.includes(prismaType))
  nativeTypes.forEach((element) => {
    if (element._number_of_args + element._number_of_optional_args !== 0) {
      const documentation = buildDocumentation(element)

      nativeFunctionCompletion(suggestions, element, documentation)
    } else {
      nativeTypeCompletion(suggestions, element)
    }
  })

  return suggestions
}
