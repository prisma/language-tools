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
  dataSourceProviders,
  dataSourceProviderArguments,
  generatorProviders,
  generatorProviderArguments,
  previewFeaturesArguments,
} from './completionUtil'
import { klona } from 'klona'
import { extractModelName } from '../rename/renameUtil'
import previewFeatures from '../prisma-fmt/previewFeatures'
import nativeTypeConstructors, {
  NativeTypeConstructors,
} from '../prisma-fmt/nativeTypes'

function toCompletionItems(
  allowedTypes: string[],
  kind: CompletionItemKind,
): CompletionItem[] {
  return allowedTypes.map((label) => ({ label, kind }))
}

/***
 * @param symbols expects e.g. '()', '[]' or '""'
 */
export function isInsideAttribute(
  currentLineUntrimmed: string,
  position: Position,
  symbols: string,
): boolean {
  let numberOfOpenBrackets = 0
  let numberOfClosedBrackets = 0
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === symbols[0]) {
      numberOfOpenBrackets++
    } else if (currentLineUntrimmed[i] === symbols[1]) {
      numberOfClosedBrackets++
    }
  }
  return numberOfOpenBrackets > numberOfClosedBrackets
}

/***
 * Checks if inside e.g. "here"
 * Does not check for escaped quotation marks.
 */
export function isInsideQuotationMark(
  currentLineUntrimmed: string,
  position: Position,
): boolean {
  let insideQuotation = false
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === '"') {
      insideQuotation = !insideQuotation
    }
  }
  return insideQuotation
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

export function getSuggestionForNativeTypes(
  foundBlock: Block,
  wordsBeforePosition: string[],
  document: TextDocument,
  binPath: string,
  lines: string[],
): CompletionList | undefined {
  const activeFeatureFlag = declaredNativeTypes(document, binPath)
  if (
    foundBlock.type !== 'model' ||
    !activeFeatureFlag ||
    wordsBeforePosition.length < 2
  ) {
    return undefined
  }

  const datasourceName = getFirstDatasourceName(lines)
  if (
    !datasourceName ||
    wordsBeforePosition[wordsBeforePosition.length - 1] !== `@${datasourceName}`
  ) {
    return undefined
  }

  const prismaType = wordsBeforePosition[1].replace('?', '').replace('[]', '')
  const suggestions = getNativeTypes(document, prismaType, binPath)

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

export function getSuggestionForFieldAttribute(
  block: Block,
  currentLine: string,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
  binPath: string,
): CompletionList | undefined {
  if (block.type !== 'model') {
    return
  }
  // create deep copy
  let suggestions: CompletionItem[] = klona(fieldAttributes)

  const enabledNativeTypes = declaredNativeTypes(document, binPath)

  if (!(currentLine.includes('Int') || currentLine.includes('String'))) {
    // id not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== '@id')
  }
  if (!currentLine.includes('DateTime')) {
    // updatedAt not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== '@updatedAt')
  }

  suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines)

  if (enabledNativeTypes && wordsBeforePosition.length >= 2) {
    const datasourceName = getFirstDatasourceName(lines)
    const prismaType = wordsBeforePosition[1]
    const nativeTypeSuggestions = getNativeTypes(document, prismaType, binPath)

    if (datasourceName && nativeTypeSuggestions.length !== 0) {
      if (!currentLine.includes('@' + datasourceName)) {
        suggestions.push({
          kind: CompletionItemKind.Property,
          label: '@' + datasourceName,
          documentation:
            'Defines a custom type that should be used for this field.',
        })
      } else {
        suggestions.push(...nativeTypeSuggestions)
      }
    } else {
      console.log(
        'Did not receive any native type suggestions from prisma-fmt call.',
      )
    }
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

function getFirstDatasourceName(lines: string[]): string | undefined {
  const datasourceBlockFirstLine = lines.find(
    (l) => l.startsWith('datasource') && l.includes('{'),
  )
  if (!datasourceBlockFirstLine) {
    return undefined
  }
  const indexOfBracket = datasourceBlockFirstLine.indexOf('{')
  return datasourceBlockFirstLine
    .slice('datasource'.length, indexOfBracket)
    .trim()
}

export function getAllRelationNames(lines: Array<string>): Array<string> {
  const modelNames: Array<string> = []
  for (const item of lines) {
    if (
      (item.includes('model') || item.includes('enum')) &&
      item.includes('{')
    ) {
      // found a block
      const blockName = extractModelName(item)

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
          label: `${sugg.label}?`,
          kind: sugg.kind,
          documentation: sugg.documentation,
        },
        {
          label: `${sugg.label}[]`,
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

export function getValuesInsideBrackets(line: string): string[] {
  const regexp = /\[([^\]]+)\]/
  const matches = regexp.exec(line)
  if (!matches || !matches[1]) {
    return []
  }
  const result = matches[1].split(',')
  return result.map((v) => v.trim().replace('"', '').replace('"', ''))
}

function declaredNativeTypes(document: TextDocument, binPath: string): boolean {
  const nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(
    binPath,
    document.getText(),
  )
  if (nativeTypes.length === 0) {
    return false
  }
  return true
}

function handlePreviewFeatures(
  previewFeaturesArray: string[],
  position: Position,
  currentLineUntrimmed: string,
  isInsideQuotation: boolean,
): CompletionList {
  let previewFeatures: CompletionItem[] = previewFeaturesArray.map((pf) =>
    CompletionItem.create(pf),
  )
  if (isInsideAttribute(currentLineUntrimmed, position, '[]')) {
    if (isInsideQuotation) {
      const usedValues = getValuesInsideBrackets(currentLineUntrimmed)
      previewFeatures = previewFeatures.filter(
        (t) => !usedValues.includes(t.label),
      )
      return {
        items: previewFeatures,
        isIncomplete: true,
      }
    } else {
      return {
        items: previewFeaturesArguments.filter(
          (arg) => !arg.label.includes('['),
        ),
        isIncomplete: true,
      }
    }
  } else {
    return {
      items: previewFeaturesArguments.filter((arg) => !arg.label.includes('"')),
      isIncomplete: true,
    }
  }
}

function getNativeTypes(
  document: TextDocument,
  prismaType: string,
  binPath: string,
): CompletionItem[] {
  let nativeTypes: NativeTypeConstructors[] = nativeTypeConstructors(
    binPath,
    document.getText(),
  )

  if (nativeTypes.length === 0) {
    return []
  }

  const suggestions: CompletionItem[] = []
  nativeTypes = nativeTypes.filter((n) => n.prisma_types.includes(prismaType))
  nativeTypes.forEach((element) => {
    if (element._number_of_args + element._number_of_optional_args !== 0) {
      let documentation = ''
      if (element._number_of_optional_args !== 0) {
        documentation = `${documentation}Number of optional arguments: ${element._number_of_optional_args}.\n'`
      }
      if (element._number_of_args !== 0) {
        documentation = `${documentation}Number of required arguments: ${element._number_of_args}.\n`
      }
      suggestions.push({
        label: `${element.name}()`,
        kind: CompletionItemKind.TypeParameter,
        insertText: `${element.name}($0)`,
        documentation: { kind: MarkupKind.Markdown, value: documentation },
        insertTextFormat: 2,
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

export function getSuggestionForSupportedFields(
  blockType: string,
  currentLine: string,
  currentLineUntrimmed: string,
  position: Position,
  binPath: string,
): CompletionList | undefined {
  let suggestions: Array<string> = []
  const isInsideQuotation: boolean = isInsideQuotationMark(
    currentLineUntrimmed,
    position,
  )

  switch (blockType) {
    case 'generator':
      if (currentLine.startsWith('provider')) {
        const providers: CompletionItem[] = generatorProviders
        if (isInsideQuotation) {
          return {
            items: providers,
            isIncomplete: true,
          }
        } else {
          return {
            items: generatorProviderArguments,
            isIncomplete: true,
          }
        }
      }
      if (currentLine.startsWith('previewFeatures')) {
        const generatorPreviewFeatures: string[] = previewFeatures(
          binPath,
          false,
        )
        if (generatorPreviewFeatures.length > 0) {
          return handlePreviewFeatures(
            generatorPreviewFeatures,
            position,
            currentLineUntrimmed,
            isInsideQuotation,
          )
        }
      }
      break
    case 'datasource':
      if (currentLine.startsWith('provider')) {
        let providers: CompletionItem[] = klona(dataSourceProviders)

        if (isInsideAttribute(currentLineUntrimmed, position, '[]')) {
          // return providers that haven't been used yet
          if (isInsideQuotation) {
            const usedValues = getValuesInsideBrackets(currentLineUntrimmed)
            providers = providers.filter((t) => !usedValues.includes(t.label))
            return {
              items: providers,
              isIncomplete: true,
            }
          } else {
            return {
              items: dataSourceProviderArguments.filter(
                (arg) => !arg.label.includes('['),
              ),
              isIncomplete: true,
            }
          }
        } else if (isInsideQuotation) {
          return {
            items: providers,
            isIncomplete: true,
          }
        } else {
          return {
            items: dataSourceProviderArguments,
            isIncomplete: true,
          }
        }
      } else if (currentLine.startsWith('url')) {
        // check if inside env
        if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
          suggestions = ['DATABASE_URL']
        } else {
          if (currentLine.includes('env')) {
            return {
              items: dataSourceUrlArguments.filter(
                (a) => !a.label.includes('env'),
              ),
              isIncomplete: true,
            }
          }
          return {
            items: dataSourceUrlArguments,
            isIncomplete: true,
          }
        }
      }
      break
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Constant),
    isIncomplete: false,
  }
}

function getDefaultValues(
  currentLine: string,
  lines: string[],
): CompletionItem[] {
  const suggestions: CompletionItem[] = [
    {
      label: 'dbgenerated("")',
      kind: CompletionItemKind.Function,
      documentation:
        'The SQL definition of the default value which is generated by the database. This is not validated by Prisma.',
      insertText: 'dbgenerated("$0")',
      insertTextFormat: 2,
    },
  ]
  const fieldType = getFieldType(currentLine)
  if (!fieldType) {
    return []
  }

  switch (fieldType) {
    case 'Int':
      suggestions.push({
        label: 'autoincrement()',
        kind: CompletionItemKind.Function,
        documentation:
          'Create a sequence of integers in the underlying database and assign the incremented values to the ID values of the created records based on the sequence.',
      })
      break
    case 'DateTime':
      suggestions.push({
        label: 'now()',
        kind: CompletionItemKind.Function,
        documentation: {
          kind: MarkupKind.Markdown,
          value: 'Set a timestamp of the time when a record is created.',
        },
      })
      break
    case 'String':
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
      break
    case 'Boolean':
      suggestions.push(
        { label: 'true', kind: CompletionItemKind.Value },
        { label: 'false', kind: CompletionItemKind.Value },
      )
      break
  }
  const modelOrEnum = getModelOrEnumBlock(fieldType, lines)
  if (modelOrEnum && modelOrEnum.type === 'enum') {
    // get fields from enum block for suggestions
    const values: string[] = getFieldsFromCurrentBlock(lines, modelOrEnum)
    values.forEach((v) =>
      suggestions.push({ label: v, kind: CompletionItemKind.Value }),
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
      if (field !== '' && !field.startsWith('//')) {
        suggestions.push(field)
      }
    }
  }
  return suggestions
}

export function getTypesFromCurrentBlock(
  lines: Array<string>,
  block: Block,
  position?: Position,
): Map<string, number[]> {
  const suggestions: Map<string, number[]> = new Map<string, number[]>()

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
    if (!item.startsWith('@@') && (!position || key !== position.line)) {
      const type = getFieldType(item)
      if (type !== undefined) {
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        const existingSuggestion = suggestions.get(type)
        if (!existingSuggestion) {
          suggestions.set(type, [key])
        } else {
          existingSuggestion.push(key)
          suggestions.set(type, existingSuggestion)
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
      }
    }
  }
  return suggestions
}

function getFieldType(line: string): string | undefined {
  const wordsInLine: string[] = line.split(/\s+/)
  if (wordsInLine.length < 2) {
    return undefined
  }
  const type = wordsInLine[1]
  if (type.length !== 0) {
    return type
  }
  return undefined
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
      items: getDefaultValues(lines[position.line], lines),
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
