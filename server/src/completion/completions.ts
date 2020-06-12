import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
  MarkupKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Block, getModelOrEnumBlock } from '../MessageHandler'
import {
  blockAttributes,
  fieldAttributes,
  allowedBlockTypes,
  corePrimitiveTypes,
  supportedDataSourceFields,
  supportedGeneratorFields,
  relationArguments,
  dataSourceUrlArguments,
} from './completionUtil'
import klona from 'klona'

function toCompletionItems(
  allowedTypes: string[],
  kind: CompletionItemKind,
): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

/***
 * @param brackets expects either '()' or '[]'
 */
export function isInsideAttribute(
  currentLineUntrimmed: string,
  position: Position,
  brackets: string,
): boolean {
  let numberOfOpenBrackets = 0
  let numberOfClosedBrackets = 0
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === brackets[0]) {
      numberOfOpenBrackets++
    } else if (currentLineUntrimmed[i] === brackets[1]) {
      numberOfClosedBrackets++
    }
  }
  return numberOfOpenBrackets > numberOfClosedBrackets
}

export function getSymbolBeforePosition(
  document: TextDocument,
  position: Position,
): string {
  return document.getText({
    start: {
      line: position.line,
      character: position.character - 1,
    },
    end: { line: position.line, character: position.character },
  })
}

export function positionIsAfterFieldAndType(
  position: Position,
  document: TextDocument,
  wordsBeforePosition: string[],
): boolean {
  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforeIsWhiteSpace = symbolBeforePosition.search(/\s/)

  const hasAtRelation =
    wordsBeforePosition.length === 2 && symbolBeforePosition === '@'
  const hasWhiteSpaceBeforePosition =
    wordsBeforePosition.length === 2 && symbolBeforeIsWhiteSpace !== -1

  return (
    wordsBeforePosition.length > 2 ||
    hasAtRelation ||
    hasWhiteSpaceBeforePosition
  )
}

/**
 * Removes all block attribute suggestions that are invalid in this context. E.g. `@@id()` when already used should not be in the suggestions.
 */
function removeInvalidAttributeSuggestions(
  supportedAttributes: CompletionItem[],
  block: Block,
  lines: string[],
): CompletionItem[] {
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

    if (item.includes('@id')) {
      supportedAttributes = supportedAttributes.filter(
        (attribute) => !attribute.label.includes('id'),
      )
    }
    if (item.includes('@unique')) {
      supportedAttributes = supportedAttributes.filter(
        (attribute) => !attribute.label.includes('unique'),
      )
    }
  }
  return supportedAttributes
}

function getSuggestionForBlockAttribute(
  block: Block,
  lines: string[],
): CompletionItem[] {
  if (block.type !== 'model') {
    return []
  }
  // create deep copy
  let suggestions: CompletionItem[] = klona(blockAttributes)

  suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines)

  return suggestions
}

export function getSuggestionForFieldAttribute(
  block: Block,
  currentLine: string,
  lines: string[],
  position: Position,
): CompletionList | undefined {
  if (block.type !== 'model') {
    return
  }
  // create deep copy
  let suggestions: CompletionItem[] = klona(fieldAttributes)

  if (!(currentLine.includes('Int') || currentLine.includes('String'))) {
    // id not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== '@id')
  }

  suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines)

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
  position: Position,
  currentLineUntrimmed: string,
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

  const wordsBeforePosition = currentLineUntrimmed
    .slice(0, position.character)
    .split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const completeSuggestions = suggestions.filter(
    (s) => s.label.length === wordBeforePosition.length,
  )
  if (completeSuggestions.length !== 0) {
    for (const sugg of completeSuggestions) {
      suggestions.push(
        {
          label: sugg.label + '?',
          kind: sugg.kind,
          documentation: sugg.documentation,
        },
        {
          label: sugg.label + '[]',
          kind: sugg.kind,
          documentation: sugg.documentation,
        },
      )
    }
  }

  return {
    items: suggestions,
    isIncomplete: true,
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
      suggestions = getSuggestionForBlockAttribute(block, lines)
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

export function suggestEqualSymbol(
  blockType: string,
): CompletionList | undefined {
  if (!(blockType == 'datasource' || blockType == 'generator')) {
    return
  }
  const equalSymbol: CompletionItem = { label: '=' }
  return {
    items: [equalSymbol],
    isIncomplete: false,
  }
}

export function getSuggestionForSupportedFields(
  blockType: string,
  currentLine: string,
  currentLineUntrimmed: string,
  position: Position,
  gotTriggered: boolean,
): CompletionList | undefined {
  let suggestions: Array<string> = []

  switch (blockType) {
    case 'generator':
      if (currentLine.startsWith('provider')) {
        suggestions = gotTriggered
          ? ['prisma-client-js']
          : ['"prisma-client-js"'] // TODO add prisma-client-go when implemented!
      }
      break
    case 'datasource':
      if (currentLine.startsWith('provider')) {
        suggestions = gotTriggered
          ? ['postgresql', 'mysql', 'sqlite']
          : ['"postgresql"', '"mysql"', '"sqlite"']
      } else if (currentLine.startsWith('url')) {
        // check if inside env
        if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
          suggestions = gotTriggered ? ['DATABASE_URL'] : ['"DATABASE_URL"']
        } else {
          return {
            items: gotTriggered
              ? dataSourceUrlArguments.filter((a) => !a.label.includes('env'))
              : dataSourceUrlArguments,
            isIncomplete: false,
          }
        }
      }
      break
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}

function getDefaultValues(currentLine: string): CompletionItem[] {
  const suggestions: CompletionItem[] = []
  if (currentLine.includes('Int') && currentLine.includes('id')) {
    suggestions.push({
      label: 'autoincrement()',
      kind: CompletionItemKind.Function,
      documentation:
        'Create a sequence of integers in the underlying database and assign the incremented values to the ID values of the created records based on the sequence.',
    })
  } else if (currentLine.includes('DateTime')) {
    suggestions.push({
      label: 'now()',
      kind: CompletionItemKind.Function,
      documentation: {
        kind: MarkupKind.Markdown,
        value: 'Set a timestamp of the time when a record is created.',
      },
    })
  } else if (currentLine.includes('String')) {
    suggestions.push(
      {
        label: 'uuid()',
        kind: CompletionItemKind.Function,
        documentation: {
          kind: MarkupKind.Markdown,
          value:
            'Generate a globally unique identifier based on the [UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier) spec.',
        },
      },
      {
        label: 'cuid()',
        kind: CompletionItemKind.Function,
        documentation: {
          kind: MarkupKind.Markdown,
          value:
            'Generate a globally unique identifier based on the [cuid](https://github.com/ericelliott/cuid) spec.',
        },
      },
    )
  } else if (currentLine.includes('Boolean')) {
    suggestions.push(
      { label: 'true', kind: CompletionItemKind.Value },
      { label: 'false', kind: CompletionItemKind.Value },
    )
  }
  return suggestions
}

// checks if e.g. inside 'fields' or 'references' attribute
function isInsideFieldsOrReferences(
  currentLineUntrimmed: string,
  wordsBeforePosition: Array<string>,
  attributeName: string,
  position: Position,
): boolean {
  if (!isInsideAttribute(currentLineUntrimmed, position, '[]')) {
    return false
  }
  // check if in fields or references
  const indexOfFields = wordsBeforePosition.findIndex((word) =>
    word.includes('fields'),
  )
  const indexOfReferences = wordsBeforePosition.findIndex((word) =>
    word.includes('references'),
  )
  if (indexOfFields === -1 && indexOfReferences === -1) {
    return false
  }
  if (
    (indexOfFields === -1 && attributeName === 'fields') ||
    (indexOfReferences === -1 && attributeName === 'references')
  ) {
    return false
  }
  if (attributeName === 'references') {
    return indexOfReferences > indexOfFields
  }
  if (attributeName === 'fields') {
    return indexOfFields > indexOfReferences
  }
  return false
}

function getFieldsFromCurrentBlock(
  lines: Array<string>,
  block: Block,
  position?: Position,
): Array<string> {
  const suggestions: Array<string> = []

  let reachedStartLine = false
  let field = ''
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
    if (!item.startsWith('@@') && (!position || key !== position.line)) {
      field = item.replace(/ .*/, '')
      if (field !== '') {
        suggestions.push(field)
      }
    }
  }
  return suggestions
}

function getSuggestionsForRelationDirective(
  wordsBeforePosition: string[],
  currentLineUntrimmed: string,
  lines: string[],
  block: Block,
  position: Position,
): CompletionList | undefined {
  // create deep copy
  const suggestions: CompletionItem[] = klona(relationArguments)
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const stringTilPosition = currentLineUntrimmed
    .slice(0, position.character)
    .trim()

  if (wordBeforePosition.includes('@relation')) {
    return {
      items: suggestions,
      isIncomplete: false,
    }
  }
  if (
    isInsideFieldsOrReferences(
      currentLineUntrimmed,
      wordsBeforePosition,
      'fields',
      position,
    )
  ) {
    return {
      items: toCompletionItems(
        getFieldsFromCurrentBlock(lines, block, position),
        CompletionItemKind.Field,
      ),
      isIncomplete: false,
    }
  }
  if (
    isInsideFieldsOrReferences(
      currentLineUntrimmed,
      wordsBeforePosition,
      'references',
      position,
    )
  ) {
    const referencedModelName = wordsBeforePosition[1].replace('?', '')
    const referencedBlock = getModelOrEnumBlock(referencedModelName, lines)

    // referenced model does not exist
    if (!referencedBlock || referencedBlock.type !== 'model') {
      return
    }
    return {
      items: toCompletionItems(
        getFieldsFromCurrentBlock(lines, referencedBlock),
        CompletionItemKind.Field,
      ),
      isIncomplete: false,
    }
  }
  if (stringTilPosition.endsWith(',')) {
    const referencesExist = wordsBeforePosition.some((a) =>
      a.includes('references'),
    )
    const fieldsExist = wordsBeforePosition.some((a) => a.includes('fields'))
    if (referencesExist && fieldsExist) {
      return
    }
    if (referencesExist) {
      return {
        items: suggestions.filter((sugg) => !sugg.label.includes('references')),
        isIncomplete: false,
      }
    }
    if (fieldsExist) {
      return {
        items: suggestions.filter((sugg) => !sugg.label.includes('fields')),
        isIncomplete: false,
      }
    }
  }
}

export function getSuggestionsForInsideAttributes(
  untrimmedCurrentLine: string,
  lines: Array<string>,
  position: Position,
  block: Block,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const wordsBeforePosition = untrimmedCurrentLine
    .slice(0, position.character)
    .trimLeft()
    .split(/\s+/)

  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]

  if (wordBeforePosition.includes('@default')) {
    return {
      items: getDefaultValues(lines[position.line]),
      isIncomplete: false,
    }
  } else if (
    wordBeforePosition.includes('@@unique') ||
    wordBeforePosition.includes('@@id') ||
    wordBeforePosition.includes('@@index')
  ) {
    suggestions = getFieldsFromCurrentBlock(lines, block, position)
  } else if (wordsBeforePosition.some((a) => a.includes('@relation'))) {
    return getSuggestionsForRelationDirective(
      wordsBeforePosition,
      untrimmedCurrentLine,
      lines,
      block,
      position,
    )
  }
  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Field),
    isIncomplete: false,
  }
}
