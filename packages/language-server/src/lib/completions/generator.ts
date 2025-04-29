import { CompletionItem, CompletionItemKind, CompletionList, Position } from 'vscode-languageserver'

import * as completions from './completions.json'
import { Block, getValuesInsideSquareBrackets, isInsideAttribute } from '../ast'
import { convertToCompletionItems } from './internals'
import { klona } from 'klona'

import listAllAvailablePreviewFeatures from '../prisma-schema-wasm/listAllAvailablePreviewFeatures'
import { PrismaSchema } from '../Schema'

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

/**
 * Removes all field suggestion that are invalid in this context. E.g. fields that are used already in a block will not be suggested again.
 * This function removes all field suggestion that are invalid in a certain context. E.g. in a generator block `provider, output, platforms, pinnedPlatForm`
 * are possible fields. But those fields are only valid suggestions if they haven't been used in this block yet. So in case `provider` has already been used, only
 * `output, platforms, pinnedPlatform` will be suggested.
 */
function removeInvalidFieldSuggestions(
  supportedFields: string[],
  block: Block,
  schema: PrismaSchema,
  position: Position,
): string[] {
  let reachedStartLine = false
  for (const { lineIndex, text } of schema.iterLines()) {
    if (lineIndex === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine || lineIndex === position.line) {
      continue
    }
    if (lineIndex === block.range.end.line) {
      break
    }
    const fieldName = text.replace(/ .*/, '')
    if (supportedFields.includes(fieldName)) {
      supportedFields = supportedFields.filter((field) => field !== fieldName)
    }
  }
  return supportedFields
}
export function getSuggestionForGeneratorField(
  block: Block,
  schema: PrismaSchema,
  position: Position,
): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedGeneratorFields)

  const labels = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    schema,
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
