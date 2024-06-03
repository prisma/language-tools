import {
  CompletionParams,
  CompletionItem,
  CompletionList,
  CompletionTriggerKind,
  Position,
  CompletionItemKind,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import textDocumentCompletion from '../prisma-schema-wasm/textDocumentCompletion'

import {
  getCurrentLine,
  getSymbolBeforePosition,
  getBlockAtPosition,
  isFirstInsideBlock,
  positionIsAfterFieldAndType,
  isInsideAttribute,
  getFirstDatasourceProvider,
  Block,
  getAllPreviewFeaturesFromGenerators,
  getCompositeTypeFieldsRecursively,
  getDatamodelBlock,
  getFieldTypesFromCurrentBlock,
  getFieldsFromCurrentBlock,
  getValuesInsideSquareBrackets,
  isInsideFieldArgument,
  isInsideGivenProperty,
  getFieldType,
} from '../ast'

import { getSuggestionForBlockAttribute, getSuggestionForFieldAttribute } from './attributes'
import { getSuggestionForBlockTypes } from './blocks'
import { isInsideQuotationMark, suggestEqualSymbol, toCompletionItems } from './internals'
import { getSuggestionForNativeTypes, getSuggestionsForFieldTypes } from './types'
import { dataSourceSuggestions } from './datasource'
import { generatorSuggestions, getSuggestionForGeneratorField } from './generator'
import {
  relationArguments,
  opsIndexFulltextCompletion,
  filterSortLengthBasedOnInput,
  sortLengthProperties,
  getCompletionsForBlockAttributeArgs,
  getCompletionsForFieldAttributeArgs,
  booleanDefaultCompletions,
  cacheSequenceDefaultCompletion,
  incrementSequenceDefaultCompletion,
  maxValueSequenceDefaultCompletion,
  minValueSequenceDefaultCompletion,
  scalarListDefaultCompletion,
  startSequenceDefaultCompletion,
  virtualSequenceDefaultCompletion,
} from './arguments'
import {
  autoDefaultCompletion,
  dbgeneratedDefaultCompletion,
  sequenceDefaultCompletion,
  autoincrementDefaultCompletion,
  nowDefaultCompletion,
  uuidDefaultCompletion,
  cuidDefaultCompletion,
} from './functions'
import { BlockType } from '../types'
import { PrismaSchema } from '../Schema'

function getDefaultValues({
  currentLine,
  schema,
  wordsBeforePosition,
}: {
  currentLine: string
  schema: PrismaSchema
  wordsBeforePosition: string[]
}): CompletionItem[] {
  const suggestions: CompletionItem[] = []
  const datasourceProvider = getFirstDatasourceProvider(schema)

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
    scalarListDefaultCompletion(suggestions)
  }

  const dataBlock = getDatamodelBlock(fieldType, schema)
  if (dataBlock && dataBlock.type === 'enum') {
    // get fields from enum block for suggestions
    const values: string[] = getFieldsFromCurrentBlock(schema, dataBlock)
    values.forEach((v) => suggestions.push({ label: v, kind: CompletionItemKind.Value }))
  }

  return suggestions
}

function getSuggestionsForAttribute({
  attribute,
  wordsBeforePosition,
  untrimmedCurrentLine,
  schema,
  block,
  position,
}: {
  attribute?: '@relation'
  wordsBeforePosition: string[]
  untrimmedCurrentLine: string
  schema: PrismaSchema
  block: Block
  position: Position
}): CompletionList | undefined {
  const firstWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const secondWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 2]
  const wordBeforePosition = firstWordBeforePosition === '' ? secondWordBeforePosition : firstWordBeforePosition

  let suggestions: CompletionItem[] = []

  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(schema)
  // We can filter on the previewFeatures enabled
  const previewFeatures = getAllPreviewFeaturesFromGenerators(schema)

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
        items: toCompletionItems(getFieldsFromCurrentBlock(schema, block, position), CompletionItemKind.Field),
        isIncomplete: false,
      }
    }

    if (isInsideGivenProperty(untrimmedCurrentLine, wordsBeforePosition, 'references', position)) {
      // Get the name by potentially removing ? and [] from Foo? or Foo[]
      const referencedModelName = wordsBeforePosition[1].replace('?', '').replace('[]', '')
      const referencedBlock = getDatamodelBlock(referencedModelName, schema)
      // referenced model does not exist
      // TODO type?
      if (!referencedBlock || referencedBlock.type !== 'model') {
        return
      }
      return {
        items: toCompletionItems(getFieldsFromCurrentBlock(schema, referencedBlock), CompletionItemKind.Field),
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
        const fieldTypesFromCurrentBlock = getFieldTypesFromCurrentBlock(schema, block)

        const fields = getCompositeTypeFieldsRecursively(schema, currentCompositeAsArray, fieldTypesFromCurrentBlock)
        return {
          items: toCompletionItems(fields, CompletionItemKind.Field),
          isIncomplete: false,
        }
      }

      let fieldsFromCurrentBlock = getFieldsFromCurrentBlock(schema, block, position)

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

function getSuggestionsForInsideRoundBrackets(
  untrimmedCurrentLine: string,
  schema: PrismaSchema,
  position: Position,
  block: Block,
): CompletionList | undefined {
  const wordsBeforePosition = untrimmedCurrentLine.slice(0, position.character).trimLeft().split(/\s+/)

  if (wordsBeforePosition.some((a) => a.includes('@default'))) {
    return {
      items: getDefaultValues({
        currentLine: block.definingDocument.getLineContent(position.line),
        schema,
        wordsBeforePosition,
      }),
      isIncomplete: false,
    }
  } else if (wordsBeforePosition.some((a) => a.includes('@relation'))) {
    return getSuggestionsForAttribute({
      attribute: '@relation',
      wordsBeforePosition,
      untrimmedCurrentLine,
      schema,
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
      schema,
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

// Suggest fields for a BlockType
function getSuggestionForSupportedFields(
  blockType: BlockType,
  currentLine: string,
  currentLineUntrimmed: string,
  position: Position,
  schema: PrismaSchema,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const isInsideQuotation: boolean = isInsideQuotationMark(currentLineUntrimmed, position)
  // We can filter on the datasource
  const datasourceProvider = getFirstDatasourceProvider(schema)
  // We can filter on the previewFeatures enabled
  // const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

  switch (blockType) {
    case 'generator':
      return generatorSuggestions(currentLine, currentLineUntrimmed, position, isInsideQuotation, onError)
    case 'datasource':
      return dataSourceSuggestions(currentLine, isInsideQuotation, datasourceProvider)
    default:
      return undefined
  }
}

/**
 * gets suggestions for block type
 */
function getSuggestionForFirstInsideBlock(
  blockType: BlockType,
  schema: PrismaSchema,
  position: Position,
  block: Block,
): CompletionList {
  let suggestions: CompletionItem[] = []
  switch (blockType) {
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, schema, position)
      break
    case 'model':
    case 'view':
      suggestions = getSuggestionForBlockAttribute(block, schema)
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

export function prismaSchemaWasmCompletions(
  schema: PrismaSchema,
  params: CompletionParams,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const completionList = textDocumentCompletion(schema, params, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  if (completionList.items.length === 0) {
    return undefined
  } else {
    return completionList
  }
}

export function localCompletions(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: CompletionParams,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const currentLineUntrimmed = getCurrentLine(initiatingDocument, position.line)
  const currentLineTillPosition = currentLineUntrimmed.slice(0, position.character - 1).trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(initiatingDocument, position)
  const symbolBeforePositionIsWhiteSpace = symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 && !currentLineTillPosition.includes('[') && symbolBeforePositionIsWhiteSpace

  // datasource, generator, model, type or enum
  const foundBlock = getBlockAtPosition(initiatingDocument.uri, position.line, schema)
  if (!foundBlock) {
    if (wordsBeforePosition.length > 1 || (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)) {
      return
    }
    return getSuggestionForBlockTypes(schema)
  }

  if (isFirstInsideBlock(position, foundBlock.definingDocument.lines[position.line].untrimmedText)) {
    return getSuggestionForFirstInsideBlock(foundBlock.type, schema, position, foundBlock)
  }

  // Completion was triggered by a triggerCharacter
  // triggerCharacters defined in src/server.ts
  if (context?.triggerKind === CompletionTriggerKind.TriggerCharacter) {
    switch (context.triggerCharacter as '@' | '"' | '.') {
      case '@':
        if (!positionIsAfterFieldAndType(position, initiatingDocument, wordsBeforePosition)) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(initiatingDocument, position.line),
          schema,
          wordsBeforePosition,
          onError,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          foundBlock.definingDocument.getLineContent(position.line),
          currentLineUntrimmed,
          position,
          schema,
          onError,
        )
      case '.':
        // check if inside attribute
        // Useful to complete composite types
        if (['model', 'view'].includes(foundBlock.type) && isInsideAttribute(currentLineUntrimmed, position, '()')) {
          return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, schema, position, foundBlock)
        } else {
          return getSuggestionForNativeTypes(foundBlock, schema, wordsBeforePosition, onError)
        }
    }
  }

  switch (foundBlock.type) {
    case 'model':
    case 'view':
    case 'type':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, schema, position, foundBlock)
      }
      // check if field type
      if (!positionIsAfterFieldAndType(position, initiatingDocument, wordsBeforePosition)) {
        return getSuggestionsForFieldTypes(schema, position, currentLineUntrimmed)
      }
      return getSuggestionForFieldAttribute(
        foundBlock,
        foundBlock.definingDocument.getLineContent(position.line),
        schema,
        wordsBeforePosition,
        onError,
      )
    case 'datasource':
    case 'generator':
      if (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace) {
        return suggestEqualSymbol(foundBlock.type)
      }
      if (
        currentLineTillPosition.includes('=') &&
        !currentLineTillPosition.includes(']') &&
        !positionIsAfterArray &&
        symbolBeforePosition !== ','
      ) {
        return getSuggestionForSupportedFields(
          foundBlock.type,
          foundBlock.definingDocument.getLineContent(position.line),
          currentLineUntrimmed,
          position,
          schema,
          onError,
        )
      }
      break
    case 'enum':
      break
  }
}
