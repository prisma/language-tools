import { CompletionItem, Position } from 'vscode-languageserver'

import { Block, BlockType } from '../ast'

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
