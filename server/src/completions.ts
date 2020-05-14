import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { MyBlock } from './MessageHandler'
import {
  blockAttributes,
  fieldAttributes,
  allowedBlockTypes,
  corePrimitiveTypes,
  supportedDataSourceFields,
  supportedGeneratorFields,
} from './completionUtil'

function toCompletionItems(
  allowedTypes: string[],
  kind: CompletionItemKind,
): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

function getSuggestionForBlockAttribute(blockType: string): CompletionItem[] {
  if (blockType !== 'model') {
    return []
  }
  return blockAttributes
}

function getSuggestionForFieldAttribute(
  blockType: string,
  position: Position,
  currentLine: string,
): CompletionItem[] {
  if (blockType !== 'model' && blockType !== 'type_alias') {
    return []
  }
  let suggestions: CompletionItem[] = fieldAttributes

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
): CompletionList {
  const symbolBeforePosition = document.getText({
    start: { line: position.line, character: position.character - 2 },
    end: { line: position.line, character: position.character },
  })
  let suggestions: CompletionItem[] = []

  if (symbolBeforePosition === '@@') {
    suggestions = getSuggestionForBlockAttribute(blockType)
  } else if (symbolBeforePosition === ' @') {
    const blockAttributeSuggestions: CompletionItem[] = getSuggestionForBlockAttribute(
      blockType,
    )
    for (const suggestion of blockAttributeSuggestions) {
      suggestion.data = '@' + suggestion.label
    }
    suggestions = getSuggestionForFieldAttribute(
      blockType,
      position,
      currentLine,
    ).concat(blockAttributeSuggestions)
  } else {
    // valid schema
    const fieldAttributeSuggestions = getSuggestionForFieldAttribute(
      blockType,
      position,
      currentLine,
    )
    for (const suggestion of fieldAttributeSuggestions) {
      suggestion.label = '@' + suggestion.label
    }
    const blockAttributeSuggestions = getSuggestionForBlockAttribute(blockType)
    for (const suggestion of blockAttributeSuggestions) {
      suggestion.label = '@' + suggestion.label
    }
    suggestions = fieldAttributeSuggestions.concat(blockAttributeSuggestions)
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

export function getAllRelationNamesWithoutAst(
  lines: Array<string>,
  currentModelStartLine: number,
): Array<string> {
  const modelNames: Array<string> = []
  for (const [key, item] of lines.entries()) {
    if (currentModelStartLine === key) {
      // do not suggest the model name we are currently in
      continue
    }
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
  foundBlock: MyBlock,
  lines: Array<string>,
): CompletionList {
  const suggestions: CompletionItem[] = corePrimitiveTypes

  if (foundBlock instanceof MyBlock) {
    // get all model names
    const modelNames: Array<string> = getAllRelationNamesWithoutAst(
      lines,
      foundBlock.start.line,
    )
    suggestions.push(
      ...toCompletionItems(modelNames, CompletionItemKind.TypeParameter),
    )
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

function removeInvalidFieldSuggestions(
  supportedFields: Array<string>,
  block: MyBlock,
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
      supportedFields.filter((field) => field !== fieldName)
    }
  }
  return supportedFields
}

function getSuggestionForDataSourceField(
  block: MyBlock,
  lines: Array<string>,
  position: Position,
): CompletionItem[] {
  const labels: Array<string> = removeInvalidFieldSuggestions(
    supportedDataSourceFields.map((item) => item.label),
    block,
    lines,
    position,
  )

  return supportedDataSourceFields.filter((item) => labels.includes(item.label))
}

function getSuggestionForGeneratorField(
  block: MyBlock,
  lines: Array<string>,
  position: Position,
): CompletionItem[] {
  const labels = removeInvalidFieldSuggestions(
    supportedGeneratorFields.map((item) => item.label),
    block,
    lines,
    position,
  )

  return supportedGeneratorFields.filter((item) => labels.includes(item.label))
}

/**
 * gets suggestions for block typ
 */
export function getSuggestionForFirstInsideBlock(
  blockType: string,
  lines: Array<string>,
  position: Position,
  block: MyBlock,
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
      suggestions = getSuggestionForBlockAttribute(blockType)
      for (const suggestion of suggestions) {
        suggestion.label = '@@' + suggestion.label
      }
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
  const suggestions: CompletionItem[] = allowedBlockTypes

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
      if (
        item.startsWith('provider') &&
        item.includes('sqlite')
      ) {
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
  position: Position,
  block: MyBlock,
  context?: string,
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
    if (key !== position.line) {
      suggestions.push(item.replace(/ .*/, ''))
    }
  }

  const currentLine = lines[position.line]
  if (currentLine.includes('fields') && currentLine.includes('references')) {
    const otherContext = context === 'references' ? 'fields' : 'references'
    // remove all fields that might be inside other attribute
    // e.g. if inside 'references' context, fields from 'fields' context are not correct suggestions
    const startOfOtherContext = currentLine.indexOf(otherContext + ': [')
    let end: number = startOfOtherContext
    for (end; end < currentLine.length; end++) {
      if (currentLine.charAt(end) === ']') {
        break
      }
    }
    const otherContextFieldsString = currentLine.slice(
      startOfOtherContext + otherContext.length + 3,
      end,
    )
    const otherContextFields = otherContextFieldsString.split(', ')

    // remove otherContextFields from allFieldsInBlock
    suggestions = suggestions.filter(
      (sugg) => !otherContextFields.includes(sugg),
    )
  }

  return suggestions
}

export function getSuggestionsForInsideAttributes(
  lines: Array<string>,
  position: Position,
  block: MyBlock,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const wordsBeforePosition = lines[position.line]
    .slice(0, position.character - 2)
    .split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]

  if (wordBeforePosition.includes('@default')) {
    suggestions = getFunctions(lines[position.line])
  } else if (wordBeforePosition?.includes('@relation')) {
    suggestions = ['references: []', 'fields: []', '""']
  } else if (isInsideAttribute(wordsBeforePosition, 'fields')) {
    suggestions = getFieldsFromCurrentBlock(lines, position, block, 'fields')
  } else if (isInsideAttribute(wordsBeforePosition, 'references')) {
    suggestions = getFieldsFromCurrentBlock(
      lines,
      position,
      block,
      'references',
    )
  } else if (
    wordBeforePosition.includes('@@unique') ||
    wordBeforePosition.includes('@@id') ||
    wordBeforePosition.includes('@@index')
  ) {
    suggestions = getFieldsFromCurrentBlock(lines, position, block)
  }
  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}
