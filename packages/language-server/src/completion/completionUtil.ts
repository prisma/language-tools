import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  InsertTextFormat,
  InsertTextMode,
} from 'vscode-languageserver'
import * as completions from './completions.json'

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
  blockAttribute: string,
): CompletionItem[] {
  return convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.blockAttributes.find((item) =>
      item.label.includes(blockAttribute),
    )!.params,
    CompletionItemKind.Property,
  )
}

export const blockAttributes: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.blockAttributes,
    CompletionItemKind.Property,
  )

export function givenFieldAttributeParams(
  fieldAttribute: '@unique' | '@id' | '@index',
  previewFeatures: string[] | undefined,
  datasourceProvider: string | undefined,
): CompletionItem[] {
  const items = convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.fieldAttributes.find((item) =>
      item.label.includes(fieldAttribute),
    )!.params,
    CompletionItemKind.Property,
  )

  if (fieldAttribute === '@index') {
    // filter length and sort out
    return items.filter((arg) => arg.label !== 'length' && arg.label !== 'sort')
  }

  if (previewFeatures?.includes('extendedIndexes')) {
    // The sort argument is available for all databases on @unique
    // The length argument is available on MySQL on @id, @unique
    // Additionally, SQL Server also allows it on @id
    if (datasourceProvider === 'mysql') {
      return items
    } else if (datasourceProvider === 'sqlserver') {
      if (fieldAttribute === '@id') {
        return items
      } else {
        return items.filter((arg) => arg.label !== 'length')
      }
    }

    if (datasourceProvider !== 'mysql') {
      return items.filter((arg) => arg.label !== 'length')
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

export const relationArguments: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.relationArguments,
    CompletionItemKind.Property,
  )

function givenReferentialActionParams(
  referentialAction: 'onUpdate' | 'onDelete',
): CompletionItem[] {
  return convertToCompletionItems(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    completions.relationArguments.find(
      (item) => item.label === referentialAction,
    )!.params,
    CompletionItemKind.Enum,
  )
}

export const relationOnDeleteArguments: CompletionItem[] =
  givenReferentialActionParams('onDelete')

export const relationOnUpdateArguments: CompletionItem[] =
  givenReferentialActionParams('onUpdate')

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
