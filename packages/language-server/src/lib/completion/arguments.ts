import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver'

import { convertAttributesToCompletionItems, convertToCompletionItems } from './internals'

import * as completions from './completions.json'
import { PreviewFeatures } from '../types'

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

/**
 * ```prisma
 * model A {
 *  id    Int @id
 *  field Int @unique(sort: |)
 *  otherField Int
 *
 *  \@@unique(fields: [otherField(sort: |)])
 *  \@@index(fields: [id(sort: |)])
 * }
 * ```
 * And then specifically Sql Server, we also return:
 * ```prisma
 *  model A {
 *  id    Int @id(sort: |)
 *
 *  \@@id(fields: [id(sort: |)])
 * }
 * ```
 */
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
