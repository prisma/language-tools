import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  InsertTextFormat,
  InsertTextMode,
} from 'vscode-languageserver'
import * as completions from './completions.json'
import type { PreviewFeatures } from '../previewFeatures'

type JSONSimpleCompletionItems = {
  label: string
  insertText?: string // optional text to use as completion instead of label
  documentation?: string
}[]

/**
 * Converts a json object containing labels and documentations to CompletionItems.
 */
function convertToCompletionItems(
  completionItems: JSONSimpleCompletionItems,
  itemKind: CompletionItemKind,
): CompletionItem[] {
  const result: CompletionItem[] = []
  for (const item of completionItems) {
    result.push({
      label: item.label,
      kind: itemKind,
      insertText: item.insertText,
      insertTextFormat: item.insertText
        ? InsertTextFormat.Snippet
        : InsertTextFormat.PlainText,
      insertTextMode: item.insertText
        ? InsertTextMode.adjustIndentation
        : undefined,
      documentation: item.documentation
        ? { kind: MarkupKind.Markdown, value: item.documentation }
        : undefined,
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
  // https://code.visualstudio.com/api/references/vscode-api#CompletionItem
  const result: CompletionItem[] = []

  for (const item of completionItems) {
    const docComment = [
      '```prisma',
      item.fullSignature,
      '```',
      '___',
      item.documentation,
    ]
    for (const param of item.params) {
      docComment.push('', '_@param_ ' + param.label + ' ' + param.documentation)
    }
    result.push({
      label: item.label,
      kind: itemKind,
      insertText: item.insertText,
      insertTextFormat: InsertTextFormat.Snippet,
      insertTextMode: item.insertText
        ? InsertTextMode.adjustIndentation
        : undefined,
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

export const supportedDataSourceFields: CompletionItem[] =
  convertToCompletionItems(
    completions.dataSourceFields,
    CompletionItemKind.Field,
  )

export const supportedGeneratorFields: CompletionItem[] =
  convertToCompletionItems(
    completions.generatorFields,
    CompletionItemKind.Field,
  )

export function givenBlockAttributeParams(
  blockAttribute: '@@unique' | '@@id' | '@@index' | '@@fulltext',
  previewFeatures?: PreviewFeatures[] | undefined,
  datasourceProvider?: string | undefined,
): CompletionItem[] {
  const items = convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.blockAttributes.find((item) =>
      item.label.includes(blockAttribute),
    )!.params,
    CompletionItemKind.Property,
  )

  if (blockAttribute === '@@index') {
    // TODO figure out if we need to add cockroachdb provider here
    if (
      previewFeatures?.includes('extendedindexes') &&
      datasourceProvider &&
      ['postgresql', 'postgres'].includes(datasourceProvider)
    ) {
      // The type argument is only available for PostgreSQL on @@index
      items.push({
        label: 'type',
        kind: 10,
        insertText: 'type: $0',
        insertTextFormat: 2,
        insertTextMode: 2,
        documentation: {
          kind: 'markdown',
          value: 'Defines the access type of indexes: BTree (default) or Hash.',
        },
      })
    }
  }

  return items
}

export const blockAttributes: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.blockAttributes,
    CompletionItemKind.Property,
  )

export const sortAutoCompletionItems: CompletionItem[] = [
  {
    label: 'Asc',
    kind: 13,
    insertTextFormat: 1,
    documentation: {
      kind: 'markdown',
      value: 'Ascending',
    },
  },
  {
    label: 'Desc',
    kind: 13,
    insertTextFormat: 1,
    documentation: {
      kind: 'markdown',
      value: 'Descending',
    },
  },
]

export function givenFieldAttributeParams(
  fieldAttribute: '@unique' | '@id' | '@@index',
  previewFeatures: PreviewFeatures[] | undefined,
  datasourceProvider: string | undefined,
  wordBeforePosition: string,
): CompletionItem[] {
  const items = convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.fieldAttributes.find((item) =>
      item.label.includes(fieldAttribute),
    )!.params,
    CompletionItemKind.Property,
  )

  return filterSortLengthBasedOnInput(
    fieldAttribute,
    previewFeatures,
    datasourceProvider,
    wordBeforePosition,
    items,
  )
}

export function filterSortLengthBasedOnInput(
  attribute: '@@unique' | '@unique' | '@@id' | '@id' | '@@index',
  previewFeatures: PreviewFeatures[] | undefined,
  datasourceProvider: string | undefined,
  wordBeforePosition: string,
  items: CompletionItem[],
): CompletionItem[] {
  if (previewFeatures?.includes('extendedindexes')) {
    // Auto completion for Desc | Asc
    // includes because `@unique(sort: |)` means wordBeforePosition = '@unique(sort:'
    if (wordBeforePosition.includes('sort:')) {
      return sortAutoCompletionItems
    }

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
      if (
        ['@unique', '@@unique', '@@index', '@id', '@@id'].includes(attribute)
      ) {
        // only filter length out
        return items.filter((arg) => arg.label !== 'length')
      } else {
        // filter length and sort out
        return items.filter(
          (arg) => arg.label !== 'length' && arg.label !== 'sort',
        )
      }
    } else {
      if (['@unique', '@@unique', '@@index'].includes(attribute)) {
        // only filter length out
        return items.filter((arg) => arg.label !== 'length')
      } else {
        // filter length and sort out
        return items.filter(
          (arg) => arg.label !== 'length' && arg.label !== 'sort',
        )
      }
    }
  }

  // filter length and sort out
  return items.filter((arg) => arg.label !== 'length' && arg.label !== 'sort')
}

export const fieldAttributes: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.fieldAttributes,
    CompletionItemKind.Property,
  )

export const sortLengthProperties: CompletionItem[] =
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  convertToCompletionItems(
    completions.fieldAttributes
      .find((item) => item.label === '@unique')!
      .params.filter(
        (item) => item.label === 'length' || item.label === 'sort',
      ),
    CompletionItemKind.Property,
  )

export const relationArguments: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.relationArguments,
    CompletionItemKind.Property,
  )

export const dataSourceUrlArguments: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.datasourceUrlArguments,
    CompletionItemKind.Property,
  )

export const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviders,
  CompletionItemKind.Constant,
)

export const dataSourceProviderArguments: CompletionItem[] =
  convertToCompletionItems(
    completions.datasourceProviderArguments,
    CompletionItemKind.Property,
  )

// generator.provider

export const generatorProviders: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviders,
  CompletionItemKind.Constant,
)

export const generatorProviderArguments: CompletionItem[] =
  convertToCompletionItems(
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
export const previewFeaturesArguments: CompletionItem[] =
  convertToCompletionItems(
    completions.previewFeaturesArguments,
    CompletionItemKind.Property,
  )
