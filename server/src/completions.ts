import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import {
  Schema,
  DataSource,
  Block,
  Generator,
  Model,
} from 'prismafile/dist/ast'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getCurrentLine, MyBlock } from './MessageHandler'

function toCompletionItems(
  allowedTypes: string[],
  kind: CompletionItemKind,
): CompletionItem[] {
  const items: CompletionItem[] = []
  allowedTypes.forEach((type) => items.push({ label: type, kind: kind }))
  return items
}

function getSuggestionForBlockAttribute(blockType: string): Array<string> {
  if (blockType != 'model') {
    return []
  }

  return ['map()', 'id()', 'unique()', 'index()']
}

function getSuggestionForFieldAttribute(
  blockType: string,
  position: Position,
  document: TextDocument,
): Array<string> {
  if (blockType != 'model' && blockType != 'type_alias') {
    return []
  }
  const currentLine = getCurrentLine(document, position.line)

  let suggestions: Array<string> = [
    'id',
    'unique',
    'map()',
    'default()',
    'relation()',
  ]

  if (!currentLine.includes('Int')) {
    // id not allowed
    suggestions = suggestions.filter((sugg) => sugg != 'id')
  }

  return suggestions
}

export function getSuggestionsForAttributes(
  blockType: string,
  position: Position,
  document: TextDocument,
): CompletionList {
  const symbolBeforePosition = document.getText({
    start: { line: position.line, character: position.character - 2 },
    end: { line: position.line, character: position.character },
  })
  let labels: string[] = []

  if (symbolBeforePosition === '@@') {
    labels = getSuggestionForBlockAttribute(blockType)
  } else if (symbolBeforePosition === ' @') {
    const blockLabels = getSuggestionForBlockAttribute(blockType)
    for (let _i = 0; _i < blockLabels.length; _i++) {
      blockLabels[_i] = '@' + blockLabels[_i]
    }
    labels = getSuggestionForFieldAttribute(
      blockType,
      position,
      document,
    ).concat(blockLabels)
  } else {
    // valid schema
    const fieldLabels = getSuggestionForFieldAttribute(
      blockType,
      position,
      document,
    )
    for (let _i = 0; _i < fieldLabels.length; _i++) {
      fieldLabels[_i] = '@' + fieldLabels[_i]
    }
    const blockLabels = getSuggestionForBlockAttribute(blockType)
    for (let _i = 0; _i < blockLabels.length; _i++) {
      blockLabels[_i] = '@@' + blockLabels[_i]
    }
    labels = fieldLabels.concat(blockLabels)
  }

  return {
    items: toCompletionItems(labels, CompletionItemKind.Property),
    isIncomplete: false,
  }
}

export function getAllRelationNamesWithoutAst(
  document: TextDocument,
  currentModelStartLine: number,
): Array<string> {
  const modelNames: Array<string> = []
  for (let _i = 0; _i < document.lineCount; _i++) {
    if (currentModelStartLine === _i) {
      // do not suggest the model name we are currently in
      continue
    }
    const currentLine = getCurrentLine(document, _i)
    if (
      (currentLine.includes('model') || currentLine.includes('enum')) &&
      currentLine.includes('{')
    ) {
      // found a block
      const trimmedLine = currentLine.trim()
      const blockType = currentLine.trim().replace(/ .*/, '')
      const blockName = trimmedLine
        .substring(blockType.length, trimmedLine.length - 1)
        .trim()

      modelNames.push(blockName)
      // block is at least 2 lines long
      _i++
    }
  }
  return modelNames
}

export const coreTypes: Array<string> = [
  'String',
  'Int',
  'Boolean',
  'Float',
  'DateTime',
]

export function getSuggestionsForTypes(
  foundBlock: Model | MyBlock,
  document: TextDocument,
  ast?: Schema,
): CompletionList {
  let suggestions: Array<string> = coreTypes

  if (foundBlock instanceof MyBlock) {
    // get all model names
    const modelNames: Array<string> = getAllRelationNamesWithoutAst(
      document,
      foundBlock.start.line,
    )
    suggestions = suggestions.concat(modelNames)
  } else if (ast) {
    const relationTypes = ast.blocks
      .filter((block) => block.type === 'model' || block.type === 'enum')
      .map((model) => model.name.name)
      .filter((modelName) => modelName != foundBlock.name.name)
    suggestions = suggestions.concat(relationTypes)
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.TypeParameter),
    isIncomplete: false,
  }
}

function removeInvalidFieldSuggestions(
  supportedFields: Array<string>,
  block: DataSource | Generator | MyBlock,
  document: TextDocument,
  position: Position,
): Array<string> {
  if (block instanceof MyBlock) {
    for (let _i = block.start.line + 1; _i < block.end.line; _i++) {
      if (_i === position.line) {
        continue
      }
      const currentLine = getCurrentLine(document, _i)
      const fieldName = currentLine.replace(/ .*/, '')
      if (supportedFields.includes(fieldName)) {
        supportedFields.filter((field) => field != fieldName)
      }
    }
  } else {
    if (!block.assignments) {
      return supportedFields
    }
    block.assignments.forEach((toRemove) => {
      const index = supportedFields.indexOf(toRemove.key.name)
      supportedFields.splice(index, 1)
    })
  }
  return supportedFields
}

function getSuggestionForDataSourceField(
  block: DataSource | MyBlock,
  document: TextDocument,
  position: Position,
): string[] {
  const supportedFields = ['provider', 'url']

  return removeInvalidFieldSuggestions(
    supportedFields,
    block,
    document,
    position,
  )
}

function getSuggestionForGeneratorField(
  block: Generator | MyBlock,
  document: TextDocument,
  position: Position,
): string[] {
  const supportedFields = ['provider', 'output', 'platforms', 'pinnedPlatform']

  const suggestions = removeInvalidFieldSuggestions(
    supportedFields,
    block,
    document,
    position,
  )

  return suggestions
}

export function getSuggestionForField(
  blockType: string,
  document: TextDocument,
  position: Position,
  ast?: Schema,
  block?: Block | MyBlock,
): CompletionList {
  let result: string[] = []
  switch (blockType) {
    case 'datasource':
      result = getSuggestionForDataSourceField(
        block as DataSource,
        document,
        position,
      )
      break
    case 'generator':
      result = getSuggestionForGeneratorField(
        block as Generator,
        document,
        position,
      )
      break
    case 'model':
    case 'type_alias':
    case 'enum':
      result = []
      break
  }

  return {
    items: toCompletionItems(result, CompletionItemKind.Field),
    isIncomplete: false,
  }
}

export function getSuggestionForBlockTypes(
  ast?: Schema,
  document?: TextDocument,
): CompletionList {
  const allowedBlockTypes = [
    'datasource',
    'generator',
    'model',
    'type_alias',
    'enum',
  ]

  // enum is not supported in sqlite
  if (ast) {
    ast.blocks.forEach((block) => {
      if (block.type === 'datasource') {
        const foundNotSupportingEnumProvider = block.assignments.filter(
          (o) =>
            o.key.name === 'provider' &&
            o.value.type === 'string_value' &&
            o.value.value === 'sqlite',
        )
        if (foundNotSupportingEnumProvider.length != 0) {
          allowedBlockTypes.pop()
        }
      }
    })
  } else if (document) {
    for (let _i = 0; _i < document.lineCount - 1; _i++) {
      let currentLine = getCurrentLine(document, _i)
      if (currentLine.trim().includes('datasource')) {
        for (let _j = _i; _j < document.lineCount - 1; _j++) {
          currentLine = getCurrentLine(document, _j)
          if (currentLine.includes('}')) {
            break
          }
          if (
            currentLine.trim().startsWith('provider') &&
            currentLine.includes('sqlite')
          ) {
            allowedBlockTypes.pop()
            break
          }
        }
      }
      if (!allowedBlockTypes.includes('enum')) {
        break
      }
    }
  }

  return {
    items: toCompletionItems(allowedBlockTypes, CompletionItemKind.Class),
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
  for (let i = wordsBeforePosition.length - 1; i > 0; i--) {
    if (wordsBeforePosition[i].includes(']')) {
      break
    }
    if (wordsBeforePosition[i].includes(attributeName)) {
      return true
    }
  }
  return false
}

function getFieldsFromCurrentBlock(
  document: TextDocument,
  position: Position,
  wordsBeforePosition: Array<string>,
  block: Block | MyBlock,
  context: string,
): Array<string> {
  let suggestions: Array<string> = []
  for (let i = block.start.line; i < block.end.line - 1; i++) {
    if (i != position.line) {
      const currentLine = getCurrentLine(document, i).trim()
      suggestions.push(currentLine.replace(/ .*/, ''))
    }
  }
  const otherContext = context === 'references' ? 'fields' : 'references'

  const currentLine = getCurrentLine(document, position.line).trim()
  if (currentLine.includes('fields') && currentLine.includes('references')) {
    // remove all fields that might be inside other attribute
    // e.g. if inside 'references' context, fields from 'fields' context are not correct suggestions
    const startOfOtherContext = currentLine.indexOf(otherContext + ': [')
    let end: number = startOfOtherContext
    for (end; end < currentLine.length; end++) {
      if (currentLine.charAt(end) === ']') {
        break
      }
    }
    const otherContextFieldsString = currentLine.substring(
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
  block: Block | MyBlock,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const currentLine = getCurrentLine(document, position.line).trim()
  const wordsBeforePosition = currentLine
    .substring(0, position.character - 2)
    .split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]

  if (wordBeforePosition === '@default') {
    suggestions = getFunctions(currentLine)
  } else if (wordBeforePosition?.includes('@relation')) {
    suggestions = ['references: []', 'fields: []', '""']
  } else if (isInsideAttribute(wordsBeforePosition, 'fields')) {
    suggestions = getFieldsFromCurrentBlock(
      document,
      position,
      wordsBeforePosition,
      block,
      'fields',
    )
  } else if (isInsideAttribute(wordsBeforePosition, 'references')) {
    suggestions = getFieldsFromCurrentBlock(
      document,
      position,
      wordsBeforePosition,
      block,
      'references',
    )
  }
  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}
