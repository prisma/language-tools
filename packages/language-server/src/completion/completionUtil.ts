import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from 'vscode-languageserver'
import * as completions from './completions.json'
import { handleCompletionResolveRequest } from '../MessageHandler'

/**
 * Converts a json object containing labels and documentations to CompletionItems.
 */
function convertToCompletionItems(
  completionItems: {
    label: string
    documentation?: string
  }[],
  itemKind: CompletionItemKind,
  insertTextFunc?: (label: string) => string,
): CompletionItem[] {
  const result: CompletionItem[] = []
  for (const item of completionItems) {
    result.push({
      label: item.label,
      kind: itemKind,
      insertText: insertTextFunc ? insertTextFunc(item.label) : undefined,
      insertTextFormat: insertTextFunc ? 2 : 1,
      documentation: item.documentation
        ? { kind: MarkupKind.Markdown, value: item.documentation }
        : undefined,
    })
  }
  return result
}

/**
 * Converts a json object containing attributes including function signatures to CompletionItems.
 */
function convertAttributesToCompletionItems(
  completionItems: {
    label: string
    documentation: string
    fullSignature: string
    params: { label: string; documentation: string }[]
  }[],
  itemKind: CompletionItemKind,
  insertTextFunc: (label: string) => string,
): CompletionItem[] {
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
      insertText: insertTextFunc(item.label),
      insertTextFormat: 2,
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

export const supportedDataSourceFields: CompletionItem[] = convertToCompletionItems(
  completions.dataSourceFields,
  CompletionItemKind.Field,
)

export const supportedGeneratorFields: CompletionItem[] = convertToCompletionItems(
  completions.generatorFields,
  CompletionItemKind.Field,
)

export const blockAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.blockAttributes,
  CompletionItemKind.Property,
  (label: string) => label.replace('[]', '[$0]'),
)

export const fieldAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.fieldAttributes,
  CompletionItemKind.Property,
  (label: string) => label.replace('()', '($0)'),
)

export const relationArguments: CompletionItem[] = convertAttributesToCompletionItems(
  completions.relationArguments,
  CompletionItemKind.Property,
  (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
)

export const dataSourceUrlArguments: CompletionItem[] = convertAttributesToCompletionItems(
  completions.datasourceUrlArguments,
  CompletionItemKind.Property,
  (label: string) => label.replace('()', '($0)').replace('""', '"$0"'),
)

export const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviders,
  CompletionItemKind.Constant,
)

export const dataSourceProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviderArguments,
  CompletionItemKind.Property,
  (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
)

export const generatorProviders: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviders,
  CompletionItemKind.Constant,
)

export const generatorProviderArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorProviderArguments,
  CompletionItemKind.Property,
  (label: string) => label.replace('""', '"$0"'),
)

export const generatorPreviewFeatures: CompletionItem[] = convertToCompletionItems(
  completions.generatorPreviewFeatures,
  CompletionItemKind.Constant,
)

export const generatorPreviewFeaturesArguments: CompletionItem[] = convertToCompletionItems(
  completions.generatorPreviewFeaturesArguments,
  CompletionItemKind.Property,
  (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
)

export const mysqlNativeTypesInt: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.mysql.Int,
  CompletionItemKind.TypeParameter,
)

export const mysqlNativeTypesDecimal: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.mysql.Decimal,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const mysqlNativeTypesFloat: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.mysql.Float,
  CompletionItemKind.TypeParameter,
)

export const mysqlNativeTypesString: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.mysql.String,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const mysqlNativeTypesBytes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.mysql.Bytes,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const mysqlNativeTypesDatetime: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.mysql.DateTime,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const mysqlNativeTypesJson: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.mysql.Json,
  CompletionItemKind.TypeParameter,
)

export const postgresNativeTypesInt: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.postgresql.Int,
  CompletionItemKind.TypeParameter,
)

export const postgresNativeTypesDecimal: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.postgresql.Decimal,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const postgresNativeTypesFloat: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.postgresql.Float,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const postgresNativeTypesaString: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.postgresql.String,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const postgresNativeTypesBytes: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.postgresql.Bytes,
  CompletionItemKind.TypeParameter,
)

export const postgresNativeTypesDatetime: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.postgresql.DateTime,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const postgresNativeTypesInterval: CompletionItem[] = convertAttributesToCompletionItems(
  completions.nativeTypes.postgresql.Interval,
  CompletionItemKind.TypeParameter,
  (label: string) => label.replace('()', '($0)'),
)

export const postgresNativeTypesXML: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.postgresql.XML,
  CompletionItemKind.TypeParameter,
)

export const postgresNativeTypesJson: CompletionItem[] = convertToCompletionItems(
  completions.nativeTypes.postgresql.Json,
  CompletionItemKind.TypeParameter,
)
