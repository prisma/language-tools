import { CompletionItem, CompletionItemKind, CompletionList, Position } from 'vscode-languageserver'

import * as completions from './completions.json'
import { Block, getValuesInsideSquareBrackets, isInsideAttribute } from '../ast'
import { convertToCompletionItems } from './internals'
import { klona } from 'klona'
import { removeInvalidFieldSuggestions } from './completionUtils'
import listAllAvailablePreviewFeatures from '../prisma-schema-wasm/listAllAvailablePreviewFeatures'

/**
 * ```prisma
 * generator client {
 *  |
 * }
 * ```
 */
const supportedGeneratorFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorFields,
  CompletionItemKind.Field,
)

// generator.provider
const generatorProviders: CompletionItem[] = convertToCompletionItems(
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
const generatorProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviderArguments,
  CompletionItemKind.Property,
)

// generator.engineType
const engineTypes: CompletionItem[] = convertToCompletionItems(completions.engineTypes, CompletionItemKind.Constant)

/**
 * ```prisma
 * generator client {
 *  engineType = "|"
 * }
 * ```
 */
const engineTypeArguments: CompletionItem[] = convertToCompletionItems(
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
const previewFeaturesArguments: CompletionItem[] = convertToCompletionItems(
  completions.previewFeaturesArguments,
  CompletionItemKind.Property,
)

function handlePreviewFeatures(
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

export function getSuggestionForGeneratorField(block: Block, lines: string[], position: Position): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedGeneratorFields)

  const labels = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

export const generatorSuggestions = (
  line: string,
  untrimmedLine: string,
  position: Position,
  isInsideQuotation: boolean,
  onError?: (errorMessage: string) => void,
) => {
  // provider
  if (line.startsWith('provider')) {
    const providers: CompletionItem[] = generatorProviders
    if (isInsideQuotation) {
      return {
        items: providers,
        isIncomplete: true,
      }
    } else {
      return {
        items: generatorProviderArguments,
        isIncomplete: true,
      }
    }
  }
  // previewFeatures
  else if (line.startsWith('previewFeatures')) {
    const generatorPreviewFeatures: string[] = listAllAvailablePreviewFeatures(onError)
    if (generatorPreviewFeatures.length > 0) {
      return handlePreviewFeatures(generatorPreviewFeatures, position, untrimmedLine, isInsideQuotation)
    }
  }
  // engineType
  else if (line.startsWith('engineType')) {
    const engineTypesCompletion: CompletionItem[] = engineTypes
    if (isInsideQuotation) {
      return {
        items: engineTypesCompletion,
        isIncomplete: true,
      }
    } else {
      return {
        items: engineTypeArguments,
        isIncomplete: true,
      }
    }
  }
}
