import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from 'vscode-languageserver'
import * as completions from './completions.json'

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
  (label: string) => label.replace('()', '($0)').replace('""', '"$0"'),
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

export const blockAttributes: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.blockAttributes,
    CompletionItemKind.Property,
    (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
  )

export const fieldAttributes: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.fieldAttributes,
    CompletionItemKind.Property,
    (label: string) => label.replace('()', '($0)').replace('""', '"$0"'),
  )

export const relationArguments: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.relationArguments,
    CompletionItemKind.Property,
    (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
  )

export const dataSourceUrlArguments: CompletionItem[] =
  convertAttributesToCompletionItems(
    completions.datasourceUrlArguments,
    CompletionItemKind.Property,
    (label: string) => label.replace('()', '($0)').replace('""', '"$0"'),
  )

export const dataSourceProviders: CompletionItem[] = convertToCompletionItems(
  completions.datasourceProviders,
  CompletionItemKind.Constant,
)

export const dataSourceProviderArguments: CompletionItem[] =
  convertToCompletionItems(
    completions.datasourceProviderArguments,
    CompletionItemKind.Property,
    (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
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
    (label: string) => label.replace('""', '"$0"'),
  )

// generator.engineType

export const engineTypes: CompletionItem[] = convertToCompletionItems(
  completions.engineTypes,
  CompletionItemKind.Constant,
)

export const engineTypeArguments: CompletionItem[] =
  convertToCompletionItems(
    completions.engineTypeArguments,
    CompletionItemKind.Property,
    (label: string) => label.replace('""', '"$0"'),
  )

// generator.previewFeatures
export const previewFeaturesArguments: CompletionItem[] =
  convertToCompletionItems(
    completions.previewFeaturesArguments,
    CompletionItemKind.Property,
    (label: string) => label.replace('[]', '[$0]').replace('""', '"$0"'),
  )
