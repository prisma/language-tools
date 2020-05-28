import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Block, getModelOrEnumBlock } from './MessageHandler'
import {
  blockAttributes,
  fieldAttributes,
  allowedBlockTypes,
  corePrimitiveTypes,
  supportedDataSourceFields,
  supportedGeneratorFields,
} from './completionUtil'
import klona from 'klona'

function toCompletionItems(
  allowedTypes: string[],
  kind: CompletionItemKind,
): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

/**
 * Removes all block attribute suggestions that are invalid in this context. E.g. `@@id()` when already used should not be in the suggestions.
 */
function removeInvalidBlockAttributeSuggestions(
  supportedBlockAttributes: CompletionItem[],
  block: Block,
  lines: string[],
  position: Position,
): CompletionItem[] {
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine || key === position.line) {
      continue
    }
    if (key === block.end.line) {
      break
    }

    if (item.includes('@id')) {
      supportedBlockAttributes = supportedBlockAttributes.filter(
        (attribute) => !attribute.label.includes('id'),
      )
    }
  }
  return supportedBlockAttributes
}

function getSuggestionForBlockAttribute(
  block: Block,
  document: TextDocument,
  lines: string[],
  position: Position,
): CompletionItem[] {
  if (block.type !== 'model') {
    return []
  }
  // create deep copy
  let suggestions: CompletionItem[] = klona(blockAttributes)

  suggestions = removeInvalidBlockAttributeSuggestions(
    suggestions,
    block,
    lines,
    position,
  )

  return suggestions
}

function getSuggestionForFieldAttribute(
  blockType: string,
  currentLine: string,
): CompletionItem[] {
  if (blockType !== 'model' && blockType !== 'type_alias') {
    return []
  }
  // create deep copy
  let suggestions: CompletionItem[] = klona(fieldAttributes)

  if (!currentLine.includes('Int')) {
    // id not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== 'id')
  }

  return suggestions
}

export function getSuggestionsForAttributes(
  blockType: string,
  position: Position,
  document: TextDocument,
  currentLine: string,
): CompletionList | undefined {
  // check if position is after field name and type!
  const foundIndex = currentLine.indexOf('@')
  if (foundIndex === -1) {
    return
  }
  const wordsTillSymbol = currentLine.slice(0, foundIndex)
  const matchArray = wordsTillSymbol.match(/\s+/g)
  if (!matchArray || matchArray.length < 2) {
    return
  }

  const suggestions: CompletionItem[] = getSuggestionForFieldAttribute(
    blockType,
    currentLine,
  )

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getAllRelationNames(lines: Array<string>): Array<string> {
  const modelNames: Array<string> = []
  for (const item of lines) {
    if (
      (item.includes('model') || item.includes('enum')) &&
      item.includes('{')
    ) {
      // found a block
      const blockType = item.replace(/ .*/, '')
      const blockName = item.slice(blockType.length, item.length - 1).trim()

      modelNames.push(blockName)
      // block is at least 2 lines long
    }
  }
  return modelNames
}

export function getSuggestionsForTypes(
  foundBlock: Block,
  lines: Array<string>,
): CompletionList {
  // create deep copy
  const suggestions: CompletionItem[] = klona(corePrimitiveTypes)
  if (foundBlock instanceof Block) {
    // get all model names
    const modelNames: Array<string> = getAllRelationNames(lines)
    suggestions.push(
      ...toCompletionItems(modelNames, CompletionItemKind.Reference),
    )
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

/**
 * Removes all field suggestion that are invalid in this context. E.g. fields that are used already in a block will not be suggested again.
 * This function removes all field suggestion that are invalid in a certain context. E.g. in a generator block `provider, output, platforms, pinnedPlatForm`
 * are possible fields. But those fields are only valid suggestions if they haven't been used in this block yet. So in case `provider` has already been used, only
 * `output, platforms, pinnedPlatform` will be suggested.
 */
function removeInvalidFieldSuggestions(
  supportedFields: Array<string>,
  block: Block,
  lines: Array<string>,
  position: Position,
): Array<string> {
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine || key === position.line) {
      continue
    }
    if (key === block.end.line) {
      break
    }
    const fieldName = item.replace(/ .*/, '')
    if (supportedFields.includes(fieldName)) {
      supportedFields = supportedFields.filter((field) => field !== fieldName)
    }
  }
  return supportedFields
}

function getSuggestionForDataSourceField(
  block: Block,
  lines: Array<string>,
  position: Position,
): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedDataSourceFields)

  const labels: Array<string> = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

function getSuggestionForGeneratorField(
  block: Block,
  lines: Array<string>,
  position: Position,
): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedGeneratorFields)

  const labels = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

/**
 * gets suggestions for block typ
 */
export function getSuggestionForFirstInsideBlock(
  blockType: string,
  lines: Array<string>,
  position: Position,
  block: Block,
  document: TextDocument,
): CompletionList {
  let suggestions: CompletionItem[] = []
  switch (blockType) {
    case 'datasource':
      suggestions = getSuggestionForDataSourceField(block, lines, position)
      break
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, lines, position)
      break
    case 'model':
    case 'type_alias':
      suggestions = getSuggestionForBlockAttribute(
        block,
        document,
        lines,
        position,
      )
      break
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getSuggestionForBlockTypes(
  lines: Array<string>,
): CompletionList {
  // create deep copy
  const suggestions: CompletionItem[] = klona(allowedBlockTypes)

  // enum is not supported in sqlite
  let foundDataSourceBlock = false
  for (const item of lines) {
    if (item.includes('datasource')) {
      foundDataSourceBlock = true
      continue
    }
    if (foundDataSourceBlock) {
      if (item.includes('}')) {
        break
      }
      if (item.startsWith('provider') && item.includes('sqlite')) {
        suggestions.pop()
      }
    }
    if (!suggestions.map((sugg) => sugg.label).includes('enum')) {
      break
    }
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getSuggestionForSupportedFields(
  blockType: string,
  currentLine: string,
): CompletionList | undefined {
  let suggestions: Array<string> = []

  switch (blockType) {
    case 'generator':
      if (currentLine.startsWith('provider')) {
        suggestions = ['prisma-client-js'] // TODO add prisma-client-go when implemented!
      }
      break
    case 'datasource':
      if (currentLine.startsWith('provider')) {
        suggestions = ['postgresql', 'mysql', 'sqlite']
      }
      break
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}

function getFunctions(currentLine: string): Array<string> {
  const suggestions: Array<string> = ['uuid()', 'cuid()']
  if (currentLine.includes('Int') && currentLine.includes('id')) {
    suggestions.push('autoincrement()')
  }
  if (currentLine.includes('DateTime')) {
    suggestions.push('now()')
  }
  return suggestions
}

// checks if e.g. inside 'fields' or 'references' attribute
function isInsideAttribute(
  wordsBeforePosition: Array<string>,
  attributeName: string,
): boolean {
  for (const c of wordsBeforePosition.reverse()) {
    if (c.includes(']')) {
      break
    }
    if (c.includes(attributeName)) {
      return true
    }
  }
  return false
}


function getFieldsFromCurrentBlock(
  lines: Array<string>,
  block: Block,
  position?: Position,
): Array<string> {
  let suggestions: Array<string> = []

  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (key === block.start.line + 1) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (key === block.end.line) {
      break
    }
    if (!position) {
      suggestions.push(item.replace(/ .*/, ''))
    } else if (key !== position.line) {
      suggestions.push(item.replace(/ .*/, ''))
    }

  }


  return suggestions
}

export function getSuggestionsForInsideAttributes(
  lines: Array<string>,
  position: Position,
  block: Block,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const wordsBeforePosition = lines[position.line]
    .slice(0, position.character - 2)
    .split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]

  if (wordBeforePosition.includes('@default')) {
    suggestions = getFunctions(lines[position.line])
  } else if (wordBeforePosition?.includes('@relation')) {
    suggestions = ['references: [], fields: []', '""']
  } else if (isInsideAttribute(wordsBeforePosition, 'fields')) {
    suggestions = getFieldsFromCurrentBlock(lines, block, position)
  } else if (isInsideAttribute(wordsBeforePosition, 'references')) {
    const referencedModelName = wordsBeforePosition[1]
    const referencedBlock = getModelOrEnumBlock(referencedModelName, lines)

    // referenced model does not exist
    if (!referencedBlock || referencedBlock.type !== 'model') {
      return
    }

    suggestions = getFieldsFromCurrentBlock(lines, referencedBlock)

  } else if (
    wordBeforePosition.includes('@@unique') ||
    wordBeforePosition.includes('@@id') ||
    wordBeforePosition.includes('@@index')
  ) {
    suggestions = getFieldsFromCurrentBlock(lines, block, position)
  }
  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}
