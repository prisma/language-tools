import { CompletionItem, CompletionItemKind, CompletionList, InsertTextFormat } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { klona } from 'klona'

import { convertAttributesToCompletionItems } from './internals'

import * as completions from './completions.json'
import {
  Block,
  getFieldType,
  getFirstDatasourceName,
  getDatamodelBlock,
  getFirstDatasourceProvider,
  getAllPreviewFeaturesFromGenerators,
} from '../ast'

import { getNativeTypes } from './types'
import { BlockType } from '../types'
import { PrismaSchema } from '../Schema'

const fieldAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.fieldAttributes,
  CompletionItemKind.Property,
)

const blockAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.blockAttributes,
  CompletionItemKind.Property,
)

const filterContextBlockAttributes = (schema: PrismaSchema, suggestions: CompletionItem[]): CompletionItem[] => {
  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(schema)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(schema)

  // Full text indexes (MySQL and MongoDB)
  // https://www.prisma.io/docs/concepts/components/prisma-schema/indexes#full-text-indexes-mysql-and-mongodb
  const isFullTextAvailable = Boolean(
    datasourceProvider &&
      ['mysql', 'mongodb'].includes(datasourceProvider) &&
      previewFeatures?.includes('fulltextindex'),
  )

  const isMultiSchemaAvailable = Boolean(
    datasourceProvider &&
      (datasourceProvider.includes('postgres') ||
        datasourceProvider.includes('cockroachdb') ||
        datasourceProvider.includes('sqlserver')) &&
      previewFeatures?.includes('multischema'),
  )

  if (isFullTextAvailable === false) {
    // fullTextIndex is not available, we need to filter it out
    suggestions = suggestions.filter((arg) => arg.label !== '@@fulltext')
  }

  if (!isMultiSchemaAvailable) {
    suggestions = suggestions.filter((item) => item.label !== '@@schema')
  }

  return suggestions
}

/**
 * Removes all block attribute suggestions that are invalid in this context.
 * E.g. `@@id()` when already used should not be in the suggestions.
 */
function filterSuggestionsForBlock(
  suggestions: CompletionItem[],
  block: Block,
  schema: PrismaSchema,
): CompletionItem[] {
  let reachedStartLine = false

  for (const { lineIndex, text } of schema.iterLines()) {
    if (lineIndex === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (lineIndex === block.range.end.line) {
      break
    }

    // Ignore commented lines
    if (text.startsWith('//')) {
      continue
    }

    // TODO we should also remove the other suggestions if used (default()...)
    // * Filter already-present attributes that can't be duplicated
    ;['@id', '@@map', '@@ignore', '@@schema'].forEach((label) => {
      if (text.includes(label)) {
        suggestions = suggestions.filter((suggestion) => suggestion.label !== label)

        if (label === '@@ignore') {
          suggestions = suggestions.filter((suggestion) => suggestion.label !== '@ignore')
        }

        if (label === '@id') {
          suggestions = suggestions.filter((suggestion) => suggestion.label !== '@@id')
        }
      }
    })
  }

  return suggestions
}

const dataSourceNameCompletion = (items: CompletionItem[], datasourceName: string) =>
  items.push({
    // https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions
    kind: CompletionItemKind.Property,
    label: '@' + datasourceName,
    documentation:
      'Defines a native database type that should be used for this field. See https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#native-types-mapping',
    insertText: `@${datasourceName}$0`,
    insertTextFormat: InsertTextFormat.Snippet,
  })

/**
 * Removes all line attribute suggestions that are invalid in this context.
 * E.g. `@map()` when already used should not be in the suggestions.
 */
function filterSuggestionsForLine(
  suggestions: CompletionItem[],
  currentLine: string,
  fieldType: string,
  fieldBlockType?: BlockType,
) {
  if (fieldBlockType === 'type') {
    // @default & @relation are invalid on field referencing a composite type
    // we filter them out
    suggestions = suggestions.filter((sugg) => sugg.label !== '@default' && sugg.label !== '@relation')
  }

  // Tom: I think we allow ids on basically everything except relation fields
  // so it doesn't need to be restricted to Int and String.
  // These are terrible, terrible ideas of course, but you can have id DateTime @id or id Float @id.
  // TODO: decide if we want to only suggest things that make most sense or everything that is technically possible.
  const isAtIdAllowed = fieldType === 'Int' || fieldType === 'String' || fieldBlockType === 'enum'
  if (!isAtIdAllowed) {
    // id not allowed
    suggestions = suggestions.filter((suggestion) => suggestion.label !== '@id')
  }

  const isUpdatedAtAllowed = fieldType === 'DateTime'
  if (!isUpdatedAtAllowed) {
    // updatedAt not allowed
    suggestions = suggestions.filter((suggestion) => suggestion.label !== '@updatedAt')
  }

  // * Filter already-present attributes that can't be duplicated
  fieldAttributes.forEach(({ label }) => {
    if (currentLine.includes(label)) {
      suggestions = suggestions.filter((suggestion) => suggestion.label !== label)
    }
  })

  return suggestions
}

/**
 * * Only models and views currently support block attributes
 */
export function getSuggestionForBlockAttribute(block: Block, schema: PrismaSchema): CompletionItem[] {
  if (!(['model', 'view'] as BlockType[]).includes(block.type)) {
    return []
  }

  const suggestions: CompletionItem[] = filterSuggestionsForBlock(klona(blockAttributes), block, schema)

  return filterContextBlockAttributes(schema, suggestions)
}

/**
 * Should suggest all field attributes for a given field
 * EX: id Int |> @id, @default, @datasourceName, ...etc
 *
 * If `@datasourceName.` |> suggests nativeTypes
 * @param block
 * @param currentLine
 * @param lines
 * @param wordsBeforePosition
 * @param document
 * @returns
 */
export function getSuggestionForFieldAttribute(
  block: Block,
  currentLine: string,
  schema: PrismaSchema,
  wordsBeforePosition: string[],
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const fieldType = getFieldType(currentLine)
  // If we don't find a field type (e.g. String, Int...), return no suggestion
  if (!fieldType) {
    return
  }

  let suggestions: CompletionItem[] = []

  // Because @.?
  if (wordsBeforePosition.length >= 2) {
    const datasourceName = getFirstDatasourceName(schema)
    const prismaType = wordsBeforePosition[1]
    const nativeTypeSuggestions = getNativeTypes(schema, prismaType, onError)

    if (datasourceName) {
      if (!currentLine.includes(`@${datasourceName}`)) {
        dataSourceNameCompletion(suggestions, datasourceName)
      }

      if (nativeTypeSuggestions.length !== 0) {
        if (
          // Check that we are not separated by a space like `@db. |`
          wordsBeforePosition[wordsBeforePosition.length - 1] === `@${datasourceName}`
        ) {
          suggestions.push(...nativeTypeSuggestions)
          return {
            items: suggestions,
            isIncomplete: false,
          }
        }
      }
    }
  }

  suggestions.push(...fieldAttributes)

  const datamodelBlock = getDatamodelBlock(fieldType, schema)

  suggestions = filterSuggestionsForLine(suggestions, currentLine, fieldType, datamodelBlock?.type)

  suggestions = filterSuggestionsForBlock(suggestions, block, schema)

  return {
    items: suggestions,
    isIncomplete: false,
  }
}
