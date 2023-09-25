import { CompletionItem, CompletionItemKind, CompletionList, Position } from 'vscode-languageserver'

import * as completions from './completions.json'
import { getValuesInsideSquareBrackets, isInsideAttribute } from '../ast'
import { convertToCompletionItems } from './internals'

/**
 * ```prisma
 * generator client {
 *  |
 * }
 * ```
 */
export const supportedGeneratorFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorFields,
  CompletionItemKind.Field,
)

// generator.provider
export const generatorProviders: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviders,
  CompletionItemKind.Constant,
)

/**
 * ```prisma
 * generator client {
 *  provider = "|"
 * }
 * ```
 */
export const generatorProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviderArguments,
  CompletionItemKind.Property,
)

// generator.engineType
export const engineTypes: CompletionItem[] = convertToCompletionItems(
  completions.engineTypes,
  CompletionItemKind.Constant,
)

/**
 * ```prisma
 * generator client {
 *  engineType = "|"
 * }
 * ```
 */
export const engineTypeArguments: CompletionItem[] = convertToCompletionItems(
  completions.engineTypeArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *  previewFeatures = ["|"]
 * }
 * ```
 */
export const previewFeaturesArguments: CompletionItem[] = convertToCompletionItems(
  completions.previewFeaturesArguments,
  CompletionItemKind.Property,
)

export function handlePreviewFeatures(
  previewFeaturesArray: string[],
  position: Position,
  currentLineUntrimmed: string,
  isInsideQuotation: boolean,
): CompletionList {
  let previewFeatures: CompletionItem[] = previewFeaturesArray.map((pf) => CompletionItem.create(pf))
  if (isInsideAttribute(currentLineUntrimmed, position, '[]')) {
    if (isInsideQuotation) {
      const usedValues = getValuesInsideSquareBrackets(currentLineUntrimmed)
      previewFeatures = previewFeatures.filter((t) => !usedValues.includes(t.label))
      return {
        items: previewFeatures,
        isIncomplete: true,
      }
    } else {
      return {
        items: previewFeaturesArguments.filter((arg) => !arg.label.includes('[')),
        isIncomplete: true,
      }
    }
  } else {
    return {
      items: previewFeaturesArguments.filter((arg) => !arg.label.includes('"')),
      isIncomplete: true,
    }
  }
}
