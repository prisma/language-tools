import type { TextDocument } from 'vscode-languageserver-textdocument'
import {
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
  InsertTextFormat,
  InsertTextMode,
  Position,
} from 'vscode-languageserver'

import type { PreviewFeatures } from '../types'
import nativeTypeConstructors, { NativeTypeConstructors } from '../prisma-schema-wasm/nativeTypes'
import { Block, BlockType } from '../ast'

import { sqlServerClusteredValuesCompletionItems } from './arguments'

import * as completions from './completions.json'
import { convertToCompletionItems, convertAttributesToCompletionItems } from './internals'

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

export const fieldAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.fieldAttributes,
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
