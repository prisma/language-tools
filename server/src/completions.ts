import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getCurrentLine, MyBlock } from './MessageHandler'
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
  document: TextDocument,
  position: Position,
): Array<string> {
  if (block instanceof MyBlock) {
    for (let i = block.start.line + 1; i < block.end.line; i++) {
      if (i === position.line) {
        continue
      }
      const currentLine = getCurrentLine(document, i)
      const fieldName = currentLine.replace(/ .*/, '')
      if (supportedFields.includes(fieldName)) {
        supportedFields.filter((field) => field !== fieldName)
      }
    }
  }
  return supportedFields
}

function getSuggestionForDataSourceField(
  block: MyBlock,
  document: TextDocument,
  position: Position,
): CompletionItem[] {
  const labels: Array<string> = removeInvalidFieldSuggestions(
    supportedDataSourceFields.map((item) => item.label),
    block,
    document,
    position,
  )

  return supportedDataSourceFields.filter((item) => labels.includes(item.label))
}

function getSuggestionForGeneratorField(
  block: MyBlock,
  document: TextDocument,
  position: Position,
): CompletionItem[] {
  const labels = removeInvalidFieldSuggestions(
    supportedGeneratorFields.map((item) => item.label),
    block,
    document,
    position,
  )

  return supportedGeneratorFields.filter((item) => labels.includes(item.label))
}

/**
 * gets suggestions for block typ
 */
export function getSuggestionForFirstInsideBlock(
  blockType: string,
  document: TextDocument,
  position: Position,
  block: MyBlock,
): CompletionList {
  let suggestions: CompletionItem[] = []
  switch (blockType) {
    case 'datasource':
      suggestions = getSuggestionForDataSourceField(block, document, position)
      break
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, document, position)
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
  document: TextDocument,
): CompletionList {
  const suggestions: CompletionItem[] = allowedBlockTypes

  // enum is not supported in sqlite
  for (let i = 0; i < document.lineCount - 1; i++) {
    let currentLine = getCurrentLine(document, i)
    if (currentLine.trim().includes('datasource')) {
      for (let j = i; j < document.lineCount - 1; j++) {
        currentLine = getCurrentLine(document, j)
        if (currentLine.includes('}')) {
          break
        }
        if (
          currentLine.trim().startsWith('provider') &&
          currentLine.includes('sqlite')
        ) {
          suggestions.pop()
          break
        }
      }
    }
    if (!suggestions.map((item) => item.label).includes('enum')) {
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
  document: TextDocument,
  position: Position,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const currentLine = getCurrentLine(document, position.line).trim()

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
  document: TextDocument,
  position: Position,
  block: MyBlock,
  context?: string,
): Array<string> {
  let suggestions: Array<string> = []

  for (let i = block.start.line; i < block.end.line - 1; i++) {
    if (i !== position.line) {
      const currentLine = getCurrentLine(document, i).trim()
      suggestions.push(currentLine.replace(/ .*/, ''))
    }
  }

  const currentLine = getCurrentLine(document, position.line).trim()
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
  document: TextDocument,
  position: Position,
  block: MyBlock,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const currentLine = getCurrentLine(document, position.line).trim()
  const wordsBeforePosition = currentLine
    .slice(0, position.character - 2)
    .split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]

  if (wordBeforePosition.includes('@default')) {
    suggestions = getFunctions(currentLine)
  } else if (wordBeforePosition?.includes('@relation')) {
    suggestions = ['references: []', 'fields: []', '""']
  } else if (isInsideAttribute(wordsBeforePosition, 'fields')) {
    suggestions = getFieldsFromCurrentBlock(document, position, block, 'fields')
  } else if (isInsideAttribute(wordsBeforePosition, 'references')) {
    suggestions = getFieldsFromCurrentBlock(
      document,
      position,
      block,
      'references',
    )
  } else if (
    wordBeforePosition.includes('@@unique') ||
    wordBeforePosition.includes('@@id') ||
    wordBeforePosition.includes('@@index')
  ) {
    suggestions = getFieldsFromCurrentBlock(document, position, block)
  }
  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}
