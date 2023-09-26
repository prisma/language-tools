import { CompletionItem, CompletionList, CompletionItemKind, Position, InsertTextFormat } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { klona } from 'klona'
import { filterSuggestionsForBlock } from './completionUtils'

import { relationNamesMongoDBRegexFilter, relationNamesRegexFilter } from '../types'
import {
  Block,
  BlockType,
  getFieldsFromCurrentBlock,
  getFieldTypesFromCurrentBlock,
  getCompositeTypeFieldsRecursively,
  getDataBlock,
  getFirstDatasourceProvider,
  getAllPreviewFeaturesFromGenerators,
  getFirstDatasourceName,
  isInsideAttribute,
  isInsideGivenProperty,
  isInsideFieldArgument,
  getValuesInsideSquareBrackets,
  declaredNativeTypes,
  getFieldType,
  getAllRelationNames,
} from '../ast'
import { allowedBlockTypes } from './blocks'
import { generatorSuggestions, getSuggestionForGeneratorField } from './generator'
import { dataSourceProviderArguments, dataSourceProviders, relationModeValues } from './datasource'
import {
  booleanDefaultCompletions,
  cacheSequenceDefaultCompletion,
  filterSortLengthBasedOnInput,
  getCompletionsForBlockAttributeArgs,
  getCompletionsForFieldAttributeArgs,
  incrementSequenceDefaultCompletion,
  maxValueSequenceDefaultCompletion,
  minValueSequenceDefaultCompletion,
  opsIndexFulltextCompletion,
  relationArguments,
  sortLengthProperties,
  startSequenceDefaultCompletion,
  virtualSequenceDefaultCompletion,
} from './arguments'
import { corePrimitiveTypes, getNativeTypes, relationManyTypeCompletion, relationSingleTypeCompletion } from './types'
import { blockAttributes } from './attributes'
import { toCompletionItems } from './internals'
import {
  autoDefaultCompletion,
  autoincrementDefaultCompletion,
  cuidDefaultCompletion,
  dbgeneratedDefaultCompletion,
  nowDefaultCompletion,
  sequenceDefaultCompletion,
  uuidDefaultCompletion,
} from './functions'

const filterContextBlockAttributes = (
  block: Block,
  lines: string[],
  suggestions: CompletionItem[],
): CompletionItem[] => {
  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  // Full text indexes (MySQL and MongoDB)
  // https://www.prisma.io/docs/concepts/components/prisma-schema/indexes#full-text-indexes-mysql-and-mongodb
  const isFullTextAvailable = Boolean(
    datasourceProvider &&
      ['mysql', 'mongodb'].includes(datasourceProvider) &&
      previewFeatures?.includes('fulltextindex'),
  )

  const isMultiSchemaAvailable = Boolean(
    datasourceProvider &&
      (datasourceProvider.includes('postgres') ||
        datasourceProvider.includes('cockroachdb') ||
        datasourceProvider.includes('sqlserver')) &&
      previewFeatures?.includes('multischema'),
  )

  if (isFullTextAvailable === false) {
    // fullTextIndex is not available, we need to filter it out
    suggestions = suggestions.filter((arg) => arg.label !== '@@fulltext')
  }

  if (!isMultiSchemaAvailable) {
    suggestions = suggestions.filter((item) => item.label !== '@@schema')
  }

  return suggestions
}

/**
 * * Only models and views currently support block attributes
 */
function getSuggestionForBlockAttribute(block: Block, lines: string[]): CompletionItem[] {
  if (!(['model', 'view'] as BlockType[]).includes(block.type)) {
    return []
  }

  const suggestions: CompletionItem[] = filterSuggestionsForBlock(klona(blockAttributes), block, lines)

  return filterContextBlockAttributes(block, lines, suggestions)
}

export function getSuggestionForNativeTypes(
  foundBlock: Block,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const activeFeatureFlag = declaredNativeTypes(document, onError)

  if (
    // TODO type? native "@db." types?
    foundBlock.type !== 'model' ||
    !activeFeatureFlag ||
    wordsBeforePosition.length < 2
  ) {
    return undefined
  }

  const datasourceName = getFirstDatasourceName(lines)
  if (!datasourceName || wordsBeforePosition[wordsBeforePosition.length - 1] !== `@${datasourceName}`) {
    return undefined
  }

  // line
  const prismaType = wordsBeforePosition[1].replace('?', '').replace('[]', '')
  const suggestions = getNativeTypes(document, prismaType, onError)

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

export function getSuggestionsForFieldTypes(
  foundBlock: Block,
  lines: string[],
  position: Position,
  currentLineUntrimmed: string,
): CompletionList {
  const suggestions: CompletionItem[] = []

  const datasourceProvider = getFirstDatasourceProvider(lines)
  // MongoDB doesn't support Decimal
  if (datasourceProvider === 'mongodb') {
    suggestions.push(...corePrimitiveTypes.filter((s) => s.label !== 'Decimal'))
  } else {
    suggestions.push(...corePrimitiveTypes)
  }

  if (foundBlock instanceof Block) {
    // get all model names
    const modelNames: string[] =
      datasourceProvider === 'mongodb'
        ? getAllRelationNames(lines, relationNamesMongoDBRegexFilter)
        : getAllRelationNames(lines, relationNamesRegexFilter)
    suggestions.push(...toCompletionItems(modelNames, CompletionItemKind.Reference))
  }

  const wordsBeforePosition = currentLineUntrimmed.slice(0, position.character).split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const completeSuggestions = suggestions.filter((s) => s.label.length === wordBeforePosition.length)
  if (completeSuggestions.length !== 0) {
    for (const sugg of completeSuggestions) {
      relationSingleTypeCompletion(suggestions, sugg)
      relationManyTypeCompletion(suggestions, sugg)
    }
  }

  return {
    items: suggestions,
    isIncomplete: true,
  }
}

/**
 * gets suggestions for block type
 */
export function getSuggestionForFirstInsideBlock(
  blockType: BlockType,
  lines: string[],
  position: Position,
  block: Block,
): CompletionList {
  let suggestions: CompletionItem[] = []
  switch (blockType) {
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, lines, position)
      break
    case 'model':
    case 'view':
      suggestions = getSuggestionForBlockAttribute(block, lines)
      break
    case 'type':
      // No suggestions
      break
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
}

/**
 * Returns the currently available _blocks_ for completion.
 * Currently available: Generator, Datasource, Model, Enum, View
 * @param lines
 * @returns the list of block suggestions
 */
export function getSuggestionForBlockTypes(lines: string[]): CompletionList {
  // create deep copy
  let suggestions: CompletionItem[] = klona(allowedBlockTypes)

  const datasourceProvider = getFirstDatasourceProvider(lines)
  const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  const isEnumAvailable = Boolean(!datasourceProvider?.includes('sqlite'))

  const isViewAvailable = Boolean(previewFeatures?.includes('views'))

  const isTypeAvailable = Boolean(datasourceProvider?.includes('mongodb'))

  if (!isEnumAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'enum')
  }

  if (!isViewAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'view')
  }

  if (!isTypeAvailable) {
    suggestions = suggestions.filter((item) => item.label !== 'type')
  }

  return {
    items: suggestions,
    isIncomplete: false,
  }
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

// Suggest fields for a BlockType
export function getSuggestionForSupportedFields(
  blockType: BlockType,
  currentLine: string,
  currentLineUntrimmed: string,
  position: Position,
  lines: string[],
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  let suggestions: string[] = []
  const isInsideQuotation: boolean = isInsideQuotationMark(currentLineUntrimmed, position)
  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  // const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  switch (blockType) {
    case 'generator':
      return generatorSuggestions(currentLine, currentLineUntrimmed, position, isInsideQuotation, onError)
    case 'datasource':
      // provider
      if (currentLine.startsWith('provider')) {
        const providers: CompletionItem[] = dataSourceProviders

        if (isInsideQuotation) {
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
      }
      // url or shadowDatabaseUrl or directUrl
      else if (
        currentLine.startsWith('url') ||
        currentLine.startsWith('shadowDatabaseUrl') ||
        currentLine.startsWith('directUrl')
      ) {
        // check if inside env
        if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
          if (currentLine.startsWith('url')) {
            suggestions = ['DATABASE_URL']
          } else if (currentLine.startsWith('shadowDatabaseUrl')) {
            suggestions = ['SHADOW_DATABASE_URL']
          } else if (currentLine.startsWith('directUrl')) {
            suggestions = ['DIRECT_URL']
          }
        }
      }
      // `relationMode` can only be set for SQL databases
      else if (currentLine.startsWith('relationMode') && datasourceProvider !== 'mongodb') {
        const relationModeValuesSuggestion: CompletionItem[] = relationModeValues
        // values inside quotes `"value"`
        const relationModeValuesSuggestionWithQuotes: CompletionItem[] = klona(relationModeValuesSuggestion).map(
          (suggestion) => {
            suggestion.label = `"${suggestion.label}"`
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            suggestion.insertText = `"${suggestion.insertText!}"`
            return suggestion
          },
        )

        if (isInsideQuotation) {
          return {
            items: relationModeValuesSuggestion,
            isIncomplete: false,
          }
        }
        // If line ends with `"`, a value is already set.
        else if (!currentLine.endsWith('"')) {
          return {
            items: relationModeValuesSuggestionWithQuotes,
            isIncomplete: false,
          }
        }
      }
  }

  return {
    items: toCompletionItems(suggestions, CompletionItemKind.Constant),
    isIncomplete: false,
  }
}

/***
 * Checks if inside e.g. "here"
 * Does not check for escaped quotation marks.
 */
function isInsideQuotationMark(currentLineUntrimmed: string, position: Position): boolean {
  let insideQuotation = false
  for (let i = 0; i < position.character; i++) {
    if (currentLineUntrimmed[i] === '"') {
      insideQuotation = !insideQuotation
    }
  }
  return insideQuotation
}

function getDefaultValues({
  currentLine,
  lines,
  wordsBeforePosition,
}: {
  currentLine: string
  lines: string[]
  wordsBeforePosition: string[]
}): CompletionItem[] {
  const suggestions: CompletionItem[] = []
  const datasourceProvider = getFirstDatasourceProvider(lines)

  // Completions for sequence(|)
  if (datasourceProvider === 'cockroachdb') {
    if (wordsBeforePosition.some((a) => a.includes('sequence('))) {
      const sequenceProperties = ['virtual', 'minValue', 'maxValue', 'cache', 'increment', 'start']

      // No suggestions if virtual is present
      if (currentLine.includes('virtual')) {
        return suggestions
      }

      if (!sequenceProperties.some((it) => currentLine.includes(it))) {
        virtualSequenceDefaultCompletion(suggestions)
      }

      if (!currentLine.includes('minValue')) {
        minValueSequenceDefaultCompletion(suggestions)
      }
      if (!currentLine.includes('maxValue')) {
        maxValueSequenceDefaultCompletion(suggestions)
      }
      if (!currentLine.includes('cache')) {
        cacheSequenceDefaultCompletion(suggestions)
      }
      if (!currentLine.includes('increment')) {
        incrementSequenceDefaultCompletion(suggestions)
      }
      if (!currentLine.includes('start')) {
        startSequenceDefaultCompletion(suggestions)
      }

      return suggestions
    }
  }

  // MongoDB only
  if (datasourceProvider === 'mongodb') {
    autoDefaultCompletion(suggestions)
  } else {
    dbgeneratedDefaultCompletion(suggestions)
  }

  const fieldType = getFieldType(currentLine)
  // If we don't find a field type (e.g. String, Int...), return no suggestion
  if (!fieldType) {
    return []
  }

  switch (fieldType) {
    case 'BigInt':
    case 'Int':
      if (datasourceProvider === 'cockroachdb') {
        sequenceDefaultCompletion(suggestions)

        if (fieldType === 'Int') {
          // @default(autoincrement()) is only supported on BigInt fields for cockroachdb.
          break
        }
      }

      autoincrementDefaultCompletion(suggestions)
      break
    case 'DateTime':
      nowDefaultCompletion(suggestions)
      break
    case 'String':
      uuidDefaultCompletion(suggestions)
      cuidDefaultCompletion(suggestions)
      break
    case 'Boolean':
      booleanDefaultCompletions(suggestions)
      break
  }

  const isScalarList = fieldType.endsWith('[]')
  if (isScalarList) {
    suggestions.unshift({
      label: '[]',
      insertText: '[$0]',
      insertTextFormat: InsertTextFormat.Snippet,
      documentation: 'Set a default value on the list field',
      kind: CompletionItemKind.Value,
    })
  }

  const modelOrEnum = getDataBlock(fieldType, lines)
  if (modelOrEnum && modelOrEnum.type === 'enum') {
    // get fields from enum block for suggestions
    const values: string[] = getFieldsFromCurrentBlock(lines, modelOrEnum)
    values.forEach((v) => suggestions.push({ label: v, kind: CompletionItemKind.Value }))
  }

  return suggestions
}

function getSuggestionsForAttribute({
  attribute,
  wordsBeforePosition,
  untrimmedCurrentLine,
  lines,
  block,
  position,
}: {
  attribute?: '@relation'
  wordsBeforePosition: string[]
  untrimmedCurrentLine: string
  lines: string[]
  block: Block
  position: Position
}): CompletionList | undefined {
  const firstWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const secondWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 2]
  const wordBeforePosition = firstWordBeforePosition === '' ? secondWordBeforePosition : firstWordBeforePosition

  let suggestions: CompletionItem[] = []

  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(lines)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  if (attribute === '@relation') {
    if (datasourceProvider === 'mongodb') {
      suggestions = relationArguments.filter(
        (arg) => arg.label !== 'map' && arg.label !== 'onDelete' && arg.label !== 'onUpdate',
      )
    } else {
      suggestions = relationArguments
    }

    // If we are right after @relation(
    if (wordBeforePosition.includes('@relation')) {
      return {
        items: suggestions,
        isIncomplete: false,
      }
    }

    // TODO check fields with [] shortcut
    if (isInsideGivenProperty(untrimmedCurrentLine, wordsBeforePosition, 'fields', position)) {
      return {
        items: toCompletionItems(getFieldsFromCurrentBlock(lines, block, position), CompletionItemKind.Field),
        isIncomplete: false,
      }
    }

    if (isInsideGivenProperty(untrimmedCurrentLine, wordsBeforePosition, 'references', position)) {
      // Get the name by potentially removing ? and [] from Foo? or Foo[]
      const referencedModelName = wordsBeforePosition[1].replace('?', '').replace('[]', '')
      const referencedBlock = getDataBlock(referencedModelName, lines)
      // referenced model does not exist
      // TODO type?
      if (!referencedBlock || referencedBlock.type !== 'model') {
        return
      }
      return {
        items: toCompletionItems(getFieldsFromCurrentBlock(lines, referencedBlock), CompletionItemKind.Field),
        isIncomplete: false,
      }
    }
  } else {
    // @id, @unique
    // @@id, @@unique, @@index, @@fulltext

    // The length argument is available on MySQL only on the
    // @id, @@id, @unique, @@unique and @@index fields.

    // The sort argument is available for all databases on the
    // @unique, @@unique and @@index fields.
    // Additionally, SQL Server also allows it on @id and @@id.

    let attribute: '@@unique' | '@unique' | '@@id' | '@id' | '@@index' | '@@fulltext' | undefined = undefined
    if (wordsBeforePosition.some((a) => a.includes('@@id'))) {
      attribute = '@@id'
    } else if (wordsBeforePosition.some((a) => a.includes('@id'))) {
      attribute = '@id'
    } else if (wordsBeforePosition.some((a) => a.includes('@@unique'))) {
      attribute = '@@unique'
    } else if (wordsBeforePosition.some((a) => a.includes('@unique'))) {
      attribute = '@unique'
    } else if (wordsBeforePosition.some((a) => a.includes('@@index'))) {
      attribute = '@@index'
    } else if (wordsBeforePosition.some((a) => a.includes('@@fulltext'))) {
      attribute = '@@fulltext'
    }

    /**
     * inside []
     * suggest composite types for MongoDB
     * suggest fields and extendedIndexes arguments (sort / length)
     *
     * Examples
     * field attribute: slug String @unique(sort: Desc, length: 42) @db.VarChar(3000)
     * block attribute: @@id([title(length: 100, sort: Desc), abstract(length: 10)])
     */
    if (attribute && attribute !== '@@fulltext' && isInsideAttribute(untrimmedCurrentLine, position, '[]')) {
      if (isInsideFieldArgument(untrimmedCurrentLine, position)) {
        // extendedIndexes
        const items: CompletionItem[] = []
        // https://www.notion.so/prismaio/Proposal-More-PostgreSQL-index-types-GiST-GIN-SP-GiST-and-BRIN-e27ef762ee4846a9a282eec1a5129270
        if (datasourceProvider === 'postgresql' && attribute === '@@index') {
          opsIndexFulltextCompletion(items)
        }

        items.push(
          ...filterSortLengthBasedOnInput(
            attribute,
            previewFeatures,
            datasourceProvider,
            wordBeforePosition,
            sortLengthProperties,
          ),
        )

        return {
          items,
          isIncomplete: false,
        }
      }

      const fieldsFromLine = getValuesInsideSquareBrackets(untrimmedCurrentLine)

      /*
       * MongoDB composite type fields, see https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#composite-type-unique-constraints
       * Examples
       * @@unique([address.|]) or @@unique(fields: [address.|])
       * @@index([address.|]) or @@index(fields: [address.|])
       */
      if (datasourceProvider === 'mongodb' && fieldsFromLine && firstWordBeforePosition.endsWith('.')) {
        const getFieldName = (text: string): string => {
          const [_, __, value] = new RegExp(/(.*\[)?(.+)/).exec(text) || []
          let name = value
          // Example for `@@index([email,address.|])` when there is no space between fields
          if (name?.includes(',')) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            name = name.split(',').pop()!
          }
          // Remove . to only get the name
          if (name?.endsWith('.')) {
            name = name.slice(0, -1)
          }
          return name
        }

        const currentFieldName = getFieldName(firstWordBeforePosition)

        if (!currentFieldName) {
          return {
            isIncomplete: false,
            items: [],
          }
        }

        const currentCompositeAsArray = currentFieldName.split('.')
        const fieldTypesFromCurrentBlock = getFieldTypesFromCurrentBlock(lines, block)

        const fields = getCompositeTypeFieldsRecursively(lines, currentCompositeAsArray, fieldTypesFromCurrentBlock)
        return {
          items: toCompletionItems(fields, CompletionItemKind.Field),
          isIncomplete: false,
        }
      }

      let fieldsFromCurrentBlock = getFieldsFromCurrentBlock(lines, block, position)

      if (fieldsFromLine.length > 0) {
        // If we are in a composite type, exit here, to not pollute results with first level fields
        if (firstWordBeforePosition.includes('.')) {
          return {
            isIncomplete: false,
            items: [],
          }
        }

        // Remove items already used
        fieldsFromCurrentBlock = fieldsFromCurrentBlock.filter((s) => !fieldsFromLine.includes(s))

        // Return fields
        // `onCompletionResolve` will take care of filtering the partial matches
        if (
          firstWordBeforePosition !== '' &&
          !firstWordBeforePosition.endsWith(',') &&
          !firstWordBeforePosition.endsWith(', ')
        ) {
          return {
            items: toCompletionItems(fieldsFromCurrentBlock, CompletionItemKind.Field),
            isIncomplete: false,
          }
        }
      }

      return {
        items: toCompletionItems(fieldsFromCurrentBlock, CompletionItemKind.Field),
        isIncomplete: false,
      }
    }

    // "@@" block attributes
    let blockAtrributeArguments: CompletionItem[] = []
    if (attribute === '@@unique') {
      blockAtrributeArguments = getCompletionsForBlockAttributeArgs({
        blockAttributeWithParams: '@@unique',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@id') {
      blockAtrributeArguments = getCompletionsForBlockAttributeArgs({
        blockAttributeWithParams: '@@id',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@index') {
      blockAtrributeArguments = getCompletionsForBlockAttributeArgs({
        blockAttributeWithParams: '@@index',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    } else if (attribute === '@@fulltext') {
      blockAtrributeArguments = getCompletionsForBlockAttributeArgs({
        blockAttributeWithParams: '@@fulltext',
        wordBeforePosition,
        datasourceProvider,
        previewFeatures,
      })
    }

    if (blockAtrributeArguments.length) {
      suggestions = blockAtrributeArguments
    } else {
      // "@" field attributes
      let fieldAtrributeArguments: CompletionItem[] = []
      if (attribute === '@unique') {
        fieldAtrributeArguments = getCompletionsForFieldAttributeArgs(
          '@unique',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      } else if (attribute === '@id') {
        fieldAtrributeArguments = getCompletionsForFieldAttributeArgs(
          '@id',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      }
      suggestions = fieldAtrributeArguments
    }
  }

  // Check which attributes are already present
  // so we can filter them out from the suggestions
  const attributesFound: Set<string> = new Set()

  for (const word of wordsBeforePosition) {
    if (word.includes('references')) {
      attributesFound.add('references')
    }
    if (word.includes('fields')) {
      attributesFound.add('fields')
    }
    if (word.includes('onUpdate')) {
      attributesFound.add('onUpdate')
    }
    if (word.includes('onDelete')) {
      attributesFound.add('onDelete')
    }
    if (word.includes('map')) {
      attributesFound.add('map')
    }
    if (word.includes('name') || /".*"/.exec(word)) {
      attributesFound.add('name')
      attributesFound.add('""')
    }
    if (word.includes('type')) {
      attributesFound.add('type')
    }
  }

  // now filter them out of the suggestions as they are already present
  const filteredSuggestions: CompletionItem[] = suggestions.reduce(
    (accumulator: CompletionItem[] & unknown[], sugg) => {
      let suggestionMatch = false
      for (const attribute of attributesFound) {
        if (sugg.label.includes(attribute)) {
          suggestionMatch = true
        }
      }

      if (!suggestionMatch) {
        accumulator.push(sugg)
      }

      return accumulator
    },
    [],
  )

  // nothing to present any more, return
  if (filteredSuggestions.length === 0) {
    return
  }

  return {
    items: filteredSuggestions,
    isIncomplete: false,
  }
}

export function getSuggestionsForInsideRoundBrackets(
  untrimmedCurrentLine: string,
  lines: string[],
  position: Position,
  block: Block,
): CompletionList | undefined {
  const wordsBeforePosition = untrimmedCurrentLine.slice(0, position.character).trimLeft().split(/\s+/)

  if (wordsBeforePosition.some((a) => a.includes('@default'))) {
    return {
      items: getDefaultValues({
        currentLine: lines[position.line],
        lines,
        wordsBeforePosition,
      }),
      isIncomplete: false,
    }
  } else if (wordsBeforePosition.some((a) => a.includes('@relation'))) {
    return getSuggestionsForAttribute({
      attribute: '@relation',
      wordsBeforePosition,
      untrimmedCurrentLine,
      lines,
      // document,
      block,
      position,
    })
  } else if (
    // matches
    // @id, @unique
    // @@id, @@unique, @@index, @@fulltext
    wordsBeforePosition.some(
      (a) => a.includes('@unique') || a.includes('@id') || a.includes('@@index') || a.includes('@@fulltext'),
    )
  ) {
    return getSuggestionsForAttribute({
      wordsBeforePosition,
      untrimmedCurrentLine,
      lines,
      // document,
      block,
      position,
    })
  } else {
    return {
      items: toCompletionItems([], CompletionItemKind.Field),
      isIncomplete: false,
    }
  }
}
