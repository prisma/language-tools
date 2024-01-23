import { CompletionItem, CompletionItemKind, CompletionList, Position } from 'vscode-languageserver'
import { buildDocumentation, convertToCompletionItems, toCompletionItems } from './internals'

import * as completions from './completions.json'
import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { nativeFunctionCompletion } from './functions'
import {
  Block,
  declaredNativeTypes,
  getFirstDatasourceName,
  getFirstDatasourceProvider,
  getAllRelationNames,
} from '../ast'
import { relationNamesMongoDBRegexFilter, relationNamesRegexFilter } from '../constants'

/**
 * ```prisma
 * model A {
 *  field |
 * }
 * ```
 */
const corePrimitiveTypes: CompletionItem[] = convertToCompletionItems(
  completions.primitiveTypes,
  CompletionItemKind.TypeParameter,
)

const nativeTypeCompletion = (items: CompletionItem[], element: NativeTypeConstructors) =>
  items.push({
    label: element.name,
    kind: CompletionItemKind.TypeParameter,
  })

const relationSingleTypeCompletion = (items: CompletionItem[], sugg: CompletionItem) =>
  items.push({
    label: `${sugg.label}?`,
    kind: sugg.kind,
    documentation: sugg.documentation,
  })

const relationManyTypeCompletion = (items: CompletionItem[], sugg: CompletionItem) =>
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

export function getSuggestionForNativeTypes(
  foundBlock: Block,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const activeFeatureFlag = declaredNativeTypes(document, onError)

  if (
    // TODO type? native "@db." types?
    foundBlock.type !== 'model' ||
    !activeFeatureFlag ||
    wordsBeforePosition.length < 2
  ) {
    return undefined
  }

  const datasourceName = getFirstDatasourceName(lines)
  if (!datasourceName || wordsBeforePosition[wordsBeforePosition.length - 1] !== `@${datasourceName}`) {
    return undefined
  }

  // line
  const prismaType = wordsBeforePosition[1].replace('?', '').replace('[]', '')
  const suggestions = getNativeTypes(document, prismaType, onError)

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

export function getSuggestionsForFieldTypes(
  foundBlock: Block,
  lines: string[],
  position: Position,
  currentLineUntrimmed: string,
): CompletionList {
  const suggestions: CompletionItem[] = []

  const datasourceProvider = getFirstDatasourceProvider(lines)
  // MongoDB doesn't support Decimal
  if (datasourceProvider === 'mongodb') {
    suggestions.push(...corePrimitiveTypes.filter((s) => s.label !== 'Decimal'))
  } else if (datasourceProvider === 'sqlite') {
    // TODO(@druue) remove once resolved: https://github.com/prisma/prisma/issues/3786
    suggestions.push(...corePrimitiveTypes.filter((s) => s.label !== 'Json'))
  } else {
    suggestions.push(...corePrimitiveTypes)
  }

  if (foundBlock instanceof Block) {
    // get all model names
    const modelNames: string[] =
      datasourceProvider === 'mongodb'
        ? getAllRelationNames(lines, relationNamesMongoDBRegexFilter)
        : getAllRelationNames(lines, relationNamesRegexFilter)
    suggestions.push(...toCompletionItems(modelNames, CompletionItemKind.Reference))
  }

  const wordsBeforePosition = currentLineUntrimmed.slice(0, position.character).split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const completeSuggestions = suggestions.filter((s) => s.label.length === wordBeforePosition.length)
  if (completeSuggestions.length !== 0) {
    for (const sugg of completeSuggestions) {
      relationSingleTypeCompletion(suggestions, sugg)
      relationManyTypeCompletion(suggestions, sugg)
    }
  }

  return {
    items: suggestions,
    isIncomplete: true,
  }
}
