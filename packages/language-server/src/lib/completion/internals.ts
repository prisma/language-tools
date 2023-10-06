import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  InsertTextFormat,
  InsertTextMode,
  MarkupKind,
  Position,
} from 'vscode-languageserver'
import { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { BlockType } from '../types'

// Docs about CompletionItem
// https://code.visualstudio.com/api/references/vscode-api#CompletionItem

type JSONSimpleCompletionItems = {
  label: string
  insertText?: string // optional text to use as completion instead of label
  documentation?: string
  fullSignature?: string // custom signature to show
}[]

type JSONFullCompletionItems = {
  label: string
  insertText?: string // optional text to use as completion instead of label
  documentation: string
  fullSignature: string // custom signature to show
  params: { label: string; documentation: string }[]
}[]

/**
 * Converts a json object containing labels and documentations to CompletionItems.
 */
export function convertToCompletionItems(
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

/**
 * Converts a json object containing attributes including function signatures to CompletionItems.
 */
export function convertAttributesToCompletionItems(
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

export function toCompletionItems(allowedTypes: string[], kind: CompletionItemKind): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

export const buildDocumentation = (element: NativeTypeConstructors, documentation = ''): string => {
  if (element._number_of_optional_args !== 0) {
    documentation = `${documentation}Number of optional arguments: ${element._number_of_optional_args}.\n`
  }
  if (element._number_of_args !== 0) {
    documentation = `${documentation}Number of required arguments: ${element._number_of_args}.\n`
  }

  return documentation
}

export function suggestEqualSymbol(blockType: BlockType): CompletionList | undefined {
  if (!(blockType == 'datasource' || blockType == 'generator')) {
    return
  }
  const equalSymbol: CompletionItem = { label: '=' }
  return {
    items: [equalSymbol],
    isIncomplete: false,
  }
}

/***
 * Checks if inside e.g. "here"
 * Does not check for escaped quotation marks.
 */
export function isInsideQuotationMark(currentLineUntrimmed: string, position: Position): boolean {
  let insideQuotation = false
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === '"') {
      insideQuotation = !insideQuotation
    }
  }
  return insideQuotation
}
