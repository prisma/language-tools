import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { CompletionList } from 'vscode-languageserver'
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  InsertTextFormat,
  InsertTextMode,
  Position,
} from 'vscode-languageserver'
import * as completions from './completions.json'
import type { PreviewFeatures } from '../types'
import { getValuesInsideSquareBrackets } from '../ast'
import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { Block, BlockType, isInsideAttribute } from '../ast'

type JSONSimpleCompletionItems = {
  label: string
  insertText?: string // optional text to use as completion instead of label
  documentation?: string
  fullSignature?: string // custom signature to show
}[]

// Docs about CompletionItem
// https://code.visualstudio.com/api/references/vscode-api#CompletionItem

/**
 * Converts a json object containing labels and documentations to CompletionItems.
 */
function convertToCompletionItems(
  completionItems: JSONSimpleCompletionItems,
  itemKind: CompletionItemKind,
): CompletionItem[] {
  const result: CompletionItem[] = []

  for (const item of completionItems) {
    let documentationString: string | undefined = undefined

    if (item.documentation) {
      // If a "fullSignature" is provided, we want to show it in the completion item
      const documentationWithSignature =
        item.fullSignature && item.documentation
          ? ['```prisma', item.fullSignature, '```', '___', item.documentation].join('\n')
          : undefined

      // If not we only show the documentation
      documentationString = documentationWithSignature ? documentationWithSignature : item.documentation
    }

    result.push({
      label: item.label,
      kind: itemKind,
      insertText: item.insertText,
      insertTextFormat: item.insertText ? InsertTextFormat.Snippet : InsertTextFormat.PlainText,
      insertTextMode: item.insertText ? InsertTextMode.adjustIndentation : undefined,
      documentation: documentationString ? { kind: MarkupKind.Markdown, value: documentationString } : undefined,
    })
  }
  return result
}

type JSONFullCompletionItems = {
  label: string
  insertText?: string // optional text to use as completion instead of label
  documentation: string
  fullSignature: string // custom signature to show
  params: { label: string; documentation: string }[]
}[]

/**
 * Converts a json object containing attributes including function signatures to CompletionItems.
 */
function convertAttributesToCompletionItems(
  completionItems: JSONFullCompletionItems,
  itemKind: CompletionItemKind,
): CompletionItem[] {
  const result: CompletionItem[] = []

  for (const item of completionItems) {
    const docComment = ['```prisma', item.fullSignature, '```', '___', item.documentation]

    for (const param of item.params) {
      docComment.push('', '_@param_ ' + param.label + ' ' + param.documentation)
    }

    result.push({
      label: item.label,
      kind: itemKind,
      insertText: item.insertText,
      insertTextFormat: InsertTextFormat.Snippet,
      insertTextMode: item.insertText ? InsertTextMode.adjustIndentation : undefined,
      documentation: {
        kind: MarkupKind.Markdown,
        value: docComment.join('\n'),
      },
    })
  }
  return result
}

export const corePrimitiveTypes: CompletionItem[] = convertToCompletionItems(
  completions.primitiveTypes,
  CompletionItemKind.TypeParameter,
)

export const allowedBlockTypes: CompletionItem[] = convertToCompletionItems(
  completions.blockTypes,
  CompletionItemKind.Class,
)

export const relationModeValues: CompletionItem[] = convertToCompletionItems(
  completions.relationModeValues,
  CompletionItemKind.Field,
)

export const supportedGeneratorFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorFields,
  CompletionItemKind.Field,
)

export function givenBlockAttributeParams({
  blockAttribute,
  wordBeforePosition,
  datasourceProvider,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  previewFeatures,
}: {
  blockAttribute: '@@unique' | '@@id' | '@@index' | '@@fulltext'
  wordBeforePosition: string
  datasourceProvider: string | undefined
  previewFeatures: PreviewFeatures[] | undefined
}): CompletionItem[] {
  const items = convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.blockAttributes.find((item) => item.label.includes(blockAttribute))!.params,
    CompletionItemKind.Property,
  )

  // SQL Server only, suggest clustered
  if (datasourceProvider === 'sqlserver' && blockAttribute !== '@@fulltext') {
    // Auto completion for SQL Server only, clustered: true | false
    if (wordBeforePosition.includes('clustered:')) {
      return sqlServerClusteredValuesCompletionItems
    } else {
      // add clustered to suggestions
      items.push({
        label: 'clustered',
        insertText: 'clustered: $0',
        insertTextFormat: InsertTextFormat.Snippet,
        kind: CompletionItemKind.Property,
        documentation:
          'An index, unique constraint or primary key can be created as clustered or non-clustered; altering the storage and retrieve behavior of the index.',
      })
    }
  }
  // PostgreSQL only, suggest type
  else if (
    blockAttribute === '@@index' &&
    datasourceProvider &&
    ['postgresql', 'postgres'].includes(datasourceProvider)
  ) {
    // TODO figure out if we need to add cockroachdb provider here
    // The type argument is only available for PostgreSQL on @@index
    items.push({
      label: 'type',
      kind: CompletionItemKind.Property,
      insertText: 'type: $0',
      insertTextFormat: InsertTextFormat.Snippet,
      insertTextMode: InsertTextMode.adjustIndentation,
      documentation: {
        kind: 'markdown',
        value: 'Defines the access type of indexes: BTree (default) or Hash.',
      },
    })
  }

  return items
}

export const blockAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.blockAttributes,
  CompletionItemKind.Property,
)

export const sortValuesCompletionItems: CompletionItem[] = [
  {
    label: 'Asc',
    kind: CompletionItemKind.Enum,
    insertTextFormat: InsertTextFormat.PlainText,
    documentation: {
      kind: 'markdown',
      value: 'Ascending',
    },
  },
  {
    label: 'Desc',
    kind: CompletionItemKind.Enum,
    insertTextFormat: InsertTextFormat.PlainText,
    documentation: {
      kind: 'markdown',
      value: 'Descending',
    },
  },
]

export const sqlServerClusteredValuesCompletionItems: CompletionItem[] = [
  {
    label: 'true',
    kind: CompletionItemKind.Value,
    insertTextFormat: InsertTextFormat.PlainText,
    documentation: {
      kind: 'markdown',
      value: 'CLUSTERED',
    },
  },
  {
    label: 'false',
    kind: CompletionItemKind.Value,
    insertTextFormat: InsertTextFormat.PlainText,
    documentation: {
      kind: 'markdown',
      value: 'NONCLUSTERED',
    },
  },
]

export function givenFieldAttributeParams(
  fieldAttribute: '@unique' | '@id',
  previewFeatures: PreviewFeatures[] | undefined,
  datasourceProvider: string | undefined,
  wordBeforePosition: string,
): CompletionItem[] {
  const items = convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.fieldAttributes.find((item) => item.label.includes(fieldAttribute))!.params,
    CompletionItemKind.Property,
  )

  const completionItems = filterSortLengthBasedOnInput(
    fieldAttribute,
    previewFeatures,
    datasourceProvider,
    wordBeforePosition,
    items,
  )

  if (datasourceProvider === 'sqlserver') {
    // Auto completion for SQL Server only, clustered: true | false
    if (wordBeforePosition.includes('clustered:')) {
      return sqlServerClusteredValuesCompletionItems
    }
    // add clustered propery to completion items
    completionItems.push({
      label: 'clustered',
      insertText: 'clustered: $0',
      insertTextFormat: InsertTextFormat.Snippet,
      kind: CompletionItemKind.Property,
      documentation:
        'An index, unique constraint or primary key can be created as clustered or non-clustered; altering the storage and retrieve behavior of the index.',
    })
  }

  return completionItems
}

export function filterSortLengthBasedOnInput(
  attribute: '@@unique' | '@unique' | '@@id' | '@id' | '@@index',
  previewFeatures: PreviewFeatures[] | undefined,
  datasourceProvider: string | undefined,
  wordBeforePosition: string,
  items: CompletionItem[],
): CompletionItem[] {
  /*
   * 1 - Autocomplete values
   */
  // Auto completion for sort: Desc | Asc
  // includes because `@unique(sort: |)` means wordBeforePosition = '@unique(sort:'
  if (wordBeforePosition.includes('sort:')) {
    return sortValuesCompletionItems
  } else {
    /*
     * 2 - Autocomplete properties
     */

    // The length argument is available on MySQL only on the
    // @id, @@id, @unique, @@unique and @@index fields.

    // The sort argument is available for all databases on the
    // @unique, @@unique and @@index fields.
    // Additionally, SQL Server also allows it on @id and @@id.

    // Which translates too
    // - `length` argument for `@id`, `@@id`, `@unique`, `@@unique` and `@@index` (MySQL only)
    // - Note that on the `@@` the argument is on available a field - not on the top level attribute
    // - `sort` argument for `@unique`, `@@unique` and `@@index` (Additionally `@id` and `@@id` for SQL Server)

    if (datasourceProvider === 'mysql') {
      if (['@unique', '@@unique', '@@index'].includes(attribute)) {
        return items
      } else {
        // filter sort out
        return items.filter((arg) => arg.label !== 'sort')
      }
    } else if (datasourceProvider === 'sqlserver') {
      if (['@unique', '@@unique', '@@index', '@id', '@@id'].includes(attribute)) {
        // only filter length out
        return items.filter((arg) => arg.label !== 'length')
      } else {
        // filter length and sort out
        return items.filter((arg) => arg.label !== 'length' && arg.label !== 'sort')
      }
    } else {
      if (['@unique', '@@unique', '@@index'].includes(attribute)) {
        // only filter length out
        return items.filter((arg) => arg.label !== 'length')
      } else {
        // filter length and sort out
        return items.filter((arg) => arg.label !== 'length' && arg.label !== 'sort')
      }
    }
  }
}

export const fieldAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.fieldAttributes,
  CompletionItemKind.Property,
)

export const sortLengthProperties: CompletionItem[] = convertToCompletionItems(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  completions.fieldAttributes
    .find((item) => item.label === '@unique')!
    .params.filter((item) => item.label === 'length' || item.label === 'sort'),
  CompletionItemKind.Property,
)

export const relationArguments: CompletionItem[] = convertAttributesToCompletionItems(
  completions.relationArguments,
  CompletionItemKind.Property,
)

export const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviders,
  CompletionItemKind.Constant,
)

export const dataSourceProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviderArguments,
  CompletionItemKind.Property,
)

// generator.provider

export const generatorProviders: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviders,
  CompletionItemKind.Constant,
)

export const generatorProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviderArguments,
  CompletionItemKind.Property,
)

// generator.engineType

export const engineTypes: CompletionItem[] = convertToCompletionItems(
  completions.engineTypes,
  CompletionItemKind.Constant,
)

export const engineTypeArguments: CompletionItem[] = convertToCompletionItems(
  completions.engineTypeArguments,
  CompletionItemKind.Property,
)

// generator.previewFeatures
export const previewFeaturesArguments: CompletionItem[] = convertToCompletionItems(
  completions.previewFeaturesArguments,
  CompletionItemKind.Property,
)

export function toCompletionItems(allowedTypes: string[], kind: CompletionItemKind): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

/**
 * Removes all block attribute suggestions that are invalid in this context.
 * E.g. `@@id()` when already used should not be in the suggestions.
 */
export function filterSuggestionsForBlock(
  suggestions: CompletionItem[],
  block: Block,
  lines: string[],
): CompletionItem[] {
  let reachedStartLine = false

  for (const [key, item] of lines.entries()) {
    if (key === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (key === block.range.end.line) {
      break
    }

    // Ignore commented lines
    if (!item.startsWith('//')) {
      // TODO we should also remove the other suggestions if used (default()...)
      // * Filter already-present attributes that can't be duplicated
      ;['@id', '@@map', '@@ignore', '@@schema'].forEach((label) => {
        if (item.includes(label)) {
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
  }

  return suggestions
}

/**
 * Removes all line attribute suggestions that are invalid in this context.
 * E.g. `@map()` when already used should not be in the suggestions.
 */
export function filterSuggestionsForLine(
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
 * Removes all field suggestion that are invalid in this context. E.g. fields that are used already in a block will not be suggested again.
 * This function removes all field suggestion that are invalid in a certain context. E.g. in a generator block `provider, output, platforms, pinnedPlatForm`
 * are possible fields. But those fields are only valid suggestions if they haven't been used in this block yet. So in case `provider` has already been used, only
 * `output, platforms, pinnedPlatform` will be suggested.
 */
export function removeInvalidFieldSuggestions(
  supportedFields: string[],
  block: Block,
  lines: string[],
  position: Position,
): string[] {
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.range.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine || key === position.line) {
      continue
    }
    if (key === block.range.end.line) {
      break
    }
    const fieldName = item.replace(/ .*/, '')
    if (supportedFields.includes(fieldName)) {
      supportedFields = supportedFields.filter((field) => field !== fieldName)
    }
  }
  return supportedFields
}

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

      suggestions.push({
        label: `${element.name}()`,
        kind: CompletionItemKind.TypeParameter,
        insertText: `${element.name}($0)`,
        documentation: { kind: MarkupKind.Markdown, value: documentation },
        insertTextFormat: InsertTextFormat.Snippet,
      })
    } else {
      suggestions.push({
        label: element.name,
        kind: CompletionItemKind.TypeParameter,
      })
    }
  })

  return suggestions
}

const buildDocumentation = (element: NativeTypeConstructors, documentation = ''): string => {
  if (element._number_of_optional_args !== 0) {
    documentation = `${documentation}Number of optional arguments: ${element._number_of_optional_args}.\n`
  }
  if (element._number_of_args !== 0) {
    documentation = `${documentation}Number of required arguments: ${element._number_of_args}.\n`
  }

  return documentation
}
