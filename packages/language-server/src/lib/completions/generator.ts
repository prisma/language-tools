import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  Position,
  TextEdit,
  InsertTextMode,
  InsertTextFormat,
} from 'vscode-languageserver'

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
 *   provider = "|"
 * }
 * ```
 */
const generatorProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviderArguments,
  CompletionItemKind.Property,
)

// generator.previewFeatures
const previewFeaturesArguments: CompletionItem[] = convertToCompletionItems(
  completions.previewFeaturesArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   runtime = |
 * }
 * ```
 */
const runtimeArguments: CompletionItem[] = convertToCompletionItems(
  completions.runtimeArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   runtime = "|"
 * }
 * ```
 */
const runtimes: CompletionItem[] = convertToCompletionItems(completions.runtimes, CompletionItemKind.Constant)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   moduleFormats = |
 * }
 * ```
 */
const moduleFormatsArguments: CompletionItem[] = convertToCompletionItems(
  completions.moduleFormatArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   moduleFormats = "|""
 * }
 * ```
 */
const moduleFormats: CompletionItem[] = convertToCompletionItems(completions.moduleFormats, CompletionItemKind.Constant)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   generatedFileExtension = |
 * }
 * ```
 */
const generatedFileExtensionArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatedFileExtensionArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   generatedFileExtension = "|""
 * }
 * ```
 */
const generatedFileExtensions: CompletionItem[] = convertToCompletionItems(
  completions.generatedFileExtensions,
  CompletionItemKind.Constant,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   importFileExtension = |
 * }
 * ```
 */
const importFileExtensionArguments: CompletionItem[] = convertToCompletionItems(
  completions.importFileExtensionArguments,
  CompletionItemKind.Property,
)

/**
 * ```prisma
 * generator client {
 *   provider = "prisma-client"
 *   importFileExtension = "|""
 * }
 * ```
 */
const importFileExtensions: CompletionItem[] = convertToCompletionItems(
  completions.importFileExtension,
  CompletionItemKind.Constant,
)

// Fields for prisma-client generator
const prismaClientFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorPrismaClientFields,
  CompletionItemKind.Field,
)

// Fields for prisma-client-js generator
const prismaClientJSFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorPrismaClientJSFields,
  CompletionItemKind.Field,
)

/**
 * Helper function to get the provider value from a generator block
 */
function getProviderFromBlock(block: Block): string | undefined {
  const lines = block.definingDocument.lines
  for (let lineIndex = block.range.start.line + 1; lineIndex < block.range.end.line; lineIndex++) {
    const line = lines[lineIndex].text.trim()
    if (line.startsWith('provider')) {
      // given a line like `provider = "prisma-client"`, extract the value of the provider (e.g., 'prisma-client').
      const match = line.match(/\s*provider\s*=\s*"([^"]+)"/)
      return match ? match[1] : undefined
    }
  }
  return undefined
}

function handlePreviewFeatures(
  previewFeaturesArray: string[],
  position: Position,
  currentLineUntrimmed: string,
  isInsideQuotation: boolean,
): CompletionList {
  const previewFeatures: CompletionItem[] = previewFeaturesArray.map((pf) => CompletionItem.create(pf))

  if (isInsideAttribute(currentLineUntrimmed, position, '[]')) {
    if (isInsideQuotation) {
      const usedValues = getValuesInsideSquareBrackets(currentLineUntrimmed)

      return {
        items: previewFeatures.filter((t) => !usedValues.includes(t.label)),
        isIncomplete: true,
      }
    }

    return {
      items: previewFeaturesArguments.filter((arg) => !arg.label.includes('[')),
      isIncomplete: true,
    }
  } else {
    if (!isInsideQuotation) {
      return {
        items: previewFeaturesArguments.filter((arg) => !arg.label.includes('"')),
        isIncomplete: true,
      }
    }

    const firstQuoteIndex = currentLineUntrimmed.indexOf('"')
    const lastQuoteIndex = currentLineUntrimmed.lastIndexOf('"')

    const convertToListAndSuggestMore: CompletionItem = {
      additionalTextEdits: [TextEdit.insert(Position.create(position.line, lastQuoteIndex + 1), ']')],
      command: {
        command: 'editor.action.triggerSuggest',
        title: 'Trigger Suggest',
      },
      kind: CompletionItemKind.Value,
      label: '[""] (convert to list)',
      insertTextFormat: InsertTextFormat.Snippet,
      insertTextMode: InsertTextMode.asIs,
      preselect: true,
      textEdit: TextEdit.insert(Position.create(position.line, firstQuoteIndex - 1), ' ["'),
    }

    return {
      items: [convertToListAndSuggestMore],
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
  const provider = getProviderFromBlock(block)

  let suggestions: CompletionItem[]
  if (provider === 'prisma-client-js') {
    suggestions = klona(prismaClientJSFields)
  } else if (provider === 'prisma-client') {
    suggestions = klona(prismaClientFields)
  } else {
    // Default to showing all fields if no provider is set yet
    suggestions = klona(supportedGeneratorFields)
  }

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
  /**
   * Common cases for generator blocks:
   */

  // provider
  if (line.startsWith('provider')) {
    const providers: CompletionItem[] = generatorProviders
    if (isInsideQuotation) {
      return {
        items: providers,
        isIncomplete: true,
      }
    }
    return {
      items: generatorProviderArguments,
      isIncomplete: true,
    }
  }

  // previewFeatures
  if (line.startsWith('previewFeatures')) {
    const generatorPreviewFeatures: string[] = listAllAvailablePreviewFeatures(onError)
    if (generatorPreviewFeatures.length > 0) {
      return handlePreviewFeatures(generatorPreviewFeatures, position, untrimmedLine, isInsideQuotation)
    }
    return undefined
  }

  /**
   * Cases for `provider = "prisma-client"`
   */

  // runtime
  if (line.startsWith('runtime')) {
    if (isInsideQuotation) {
      return {
        items: runtimes,
        isIncomplete: true,
      }
    }
    return {
      items: runtimeArguments,
      isIncomplete: true,
    }
  }

  // runtime
  if (line.startsWith('moduleFormat')) {
    if (isInsideQuotation) {
      return {
        items: moduleFormats,
        isIncomplete: true,
      }
    }
    return {
      items: moduleFormatsArguments,
      isIncomplete: true,
    }
  }

  // generatedFileExtension
  if (line.startsWith('generatedFileExtension')) {
    if (isInsideQuotation) {
      return {
        items: generatedFileExtensions,
        isIncomplete: true,
      }
    }
    return {
      items: generatedFileExtensionArguments,
      isIncomplete: true,
    }
  }

  // importFileExtension
  if (line.startsWith('importFileExtension')) {
    if (isInsideQuotation) {
      return {
        items: importFileExtensions,
        isIncomplete: true,
      }
    }
    return {
      items: importFileExtensionArguments,
      isIncomplete: true,
    }
  }
}
