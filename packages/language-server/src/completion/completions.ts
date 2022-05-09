import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
  MarkupKind,
  InsertTextFormat,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { klona } from 'klona'
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
  engineTypes,
  engineTypeArguments,
  givenBlockAttributeParams,
  givenFieldAttributeParams,
  sortLengthProperties,
  filterSortLengthBasedOnInput,
  toCompletionItems,
  removeInvalidAttributeSuggestions,
  removeInvalidFieldSuggestions,
  getNativeTypes,
  handlePreviewFeatures,
} from './completionUtils'
import previewFeatures from '../prisma-fmt/previewFeatures'
import {
  Block,
  BlockType,
  getModelOrTypeOrEnumBlock,
  declaredNativeTypes,
  getAllRelationNames,
  isInsideAttribute,
  isInsideQuotationMark,
  isInsideFieldArgument,
  isInsideGivenProperty,
  getFirstDatasourceName,
  getFirstDatasourceProvider,
  getAllPreviewFeaturesFromGenerators,
  getFieldsFromCurrentBlock,
  getFieldType,
  getFieldTypesFromCurrentBlock,
  getValuesInsideSquareBrackets,
  getCompositeTypeFieldsRecursively,
} from '../util'

function getSuggestionForModelBlockAttribute(block: Block, lines: string[]): CompletionItem[] {
  if (block.type !== 'model') {
    return []
  }
  // create deep copy
  const suggestions: CompletionItem[] = removeInvalidAttributeSuggestions(klona(blockAttributes), block, lines)

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

  if (isFullTextAvailable === false) {
    // fullTextIndex is not available, we need to filter it out
    return suggestions.filter((arg) => arg.label !== '@@fulltext')
  }

  return suggestions
}

export function getSuggestionForNativeTypes(
  foundBlock: Block,
  lines: string[],
  wordsBeforePosition: string[],
  document: TextDocument,
): CompletionList | undefined {
  const activeFeatureFlag = declaredNativeTypes(document)
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
  const suggestions = getNativeTypes(document, prismaType)

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
): CompletionList | undefined {
  // TODO type? suggestions for "@..." for type?
  if (block.type !== 'model') {
    return
  }
  let suggestions: CompletionItem[] = []

  const enabledNativeTypes = declaredNativeTypes(document)
  // Because @.?
  if (enabledNativeTypes && wordsBeforePosition.length >= 2) {
    const datasourceName = getFirstDatasourceName(lines)
    const prismaType = wordsBeforePosition[1]
    const nativeTypeSuggestions = getNativeTypes(document, prismaType)

    if (datasourceName && nativeTypeSuggestions.length !== 0) {
      if (!currentLine.includes('@' + datasourceName)) {
        suggestions.push({
          // https://code.visualstudio.com/docs/editor/intellisense#_types-of-completions
          kind: CompletionItemKind.Property,
          label: '@' + datasourceName,
          documentation:
            'Defines a native database type that should be used for this field. See https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#native-types-mapping',
          insertText: '@db.$0',
          insertTextFormat: InsertTextFormat.Snippet,
        })
      } else if (
        // Check that we are not separated by a space like `@db. |`
        wordsBeforePosition[wordsBeforePosition.length - 1] === `@${datasourceName}`
      ) {
        suggestions.push(...nativeTypeSuggestions)
        return {
          items: suggestions,
          isIncomplete: false,
        }
      }
    } else {
      console.log('Did not receive any native type suggestions from prisma-fmt call.')
    }
  }

  suggestions.push(...fieldAttributes)

  if (!(currentLine.includes('Int') || currentLine.includes('String'))) {
    // id not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== '@id')
  }
  if (!currentLine.includes('DateTime')) {
    // updatedAt not allowed
    suggestions = suggestions.filter((sugg) => sugg.label !== '@updatedAt')
  }

  suggestions = removeInvalidAttributeSuggestions(suggestions, block, lines)

  return {
    items: suggestions,
    isIncomplete: false,
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
    const modelNames: string[] = getAllRelationNames(lines)
    suggestions.push(...toCompletionItems(modelNames, CompletionItemKind.Reference))
  }

  const wordsBeforePosition = currentLineUntrimmed.slice(0, position.character).split(' ')
  const wordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const completeSuggestions = suggestions.filter((s) => s.label.length === wordBeforePosition.length)
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

function getSuggestionForDataSourceField(block: Block, lines: string[], position: Position): CompletionItem[] {
  // create deep copy
  const suggestions: CompletionItem[] = klona(supportedDataSourceFields)

  const labels: string[] = removeInvalidFieldSuggestions(
    suggestions.map((item) => item.label),
    block,
    lines,
    position,
  )

  return suggestions.filter((item) => labels.includes(item.label))
}

function getSuggestionForGeneratorField(block: Block, lines: string[], position: Position): CompletionItem[] {
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
    case 'datasource':
      suggestions = getSuggestionForDataSourceField(block, lines, position)
      break
    case 'generator':
      suggestions = getSuggestionForGeneratorField(block, lines, position)
      break
    case 'model':
      suggestions = getSuggestionForModelBlockAttribute(block, lines)
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

export function getSuggestionForBlockTypes(lines: string[]): CompletionList {
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
): CompletionList | undefined {
  let suggestions: string[] = []
  const isInsideQuotation: boolean = isInsideQuotationMark(currentLineUntrimmed, position)

  switch (blockType) {
    case 'generator':
      // provider
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
      // previewFeatures
      if (currentLine.startsWith('previewFeatures')) {
        const generatorPreviewFeatures: string[] = previewFeatures()
        if (generatorPreviewFeatures.length > 0) {
          return handlePreviewFeatures(generatorPreviewFeatures, position, currentLineUntrimmed, isInsideQuotation)
        }
      }
      // engineType
      if (currentLine.startsWith('engineType')) {
        const engineTypesCompletion: CompletionItem[] = engineTypes
        if (isInsideQuotation) {
          // We can filter on the previewFeatures enabled
          const previewFeatures = getAllPreviewFeaturesFromGenerators(lines)

          if (previewFeatures?.includes('dataproxy')) {
            return {
              items: engineTypesCompletion,
              isIncomplete: true,
            }
          } else {
            // filter out dataproxy engineType
            return {
              items: engineTypesCompletion.filter((arg) => arg.label !== 'dataproxy'),
              isIncomplete: true,
            }
          }
        } else {
          return {
            items: engineTypeArguments,
            isIncomplete: true,
          }
        }
      }
      break
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
        // url
      } else if (currentLine.startsWith('url')) {
        // check if inside env
        if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
          suggestions = ['DATABASE_URL']
        } else {
          if (currentLine.includes('env')) {
            return {
              items: dataSourceUrlArguments.filter((a) => !a.label.includes('env')),
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
      console.log('inside sequence')
      const sequenceProperties = ['virtual', 'minValue', 'maxValue', 'cache', 'increment', 'start']

      // No suggestions if virtual is present
      if (currentLine.includes('virtual')) {
        return suggestions
      }

      // Only suggests if empty
      if (!sequenceProperties.some((it) => currentLine.includes(it))) {
        suggestions.push({
          label: 'virtual',
          insertText: 'virtual',
          kind: CompletionItemKind.Property,
          documentation:
            'Virtual sequences are sequences that do not generate monotonically increasing values and instead produce values like those generated by the built-in function unique_rowid(). They are intended for use in combination with SERIAL-typed columns.',
        })
      }

      if (!currentLine.includes('minValue')) {
        suggestions.push({
          label: 'minValue',
          insertText: 'minValue: $0',
          kind: CompletionItemKind.Property,
          documentation: 'The new minimum value of the sequence.',
        })
      }
      if (!currentLine.includes('maxValue')) {
        suggestions.push({
          label: 'maxValue',
          insertText: 'maxValue: $0',
          kind: CompletionItemKind.Property,
          documentation: 'The new maximum value of the sequence.',
        })
      }
      if (!currentLine.includes('cache')) {
        suggestions.push({
          label: 'cache',
          insertText: 'cache: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The number of sequence values to cache in memory for reuse in the session. A cache size of 1 means that there is no cache, and cache sizes of less than 1 are not valid.',
        })
      }
      if (!currentLine.includes('increment')) {
        suggestions.push({
          label: 'increment',
          insertText: 'increment: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The new value by which the sequence is incremented. A negative number creates a descending sequence. A positive number creates an ascending sequence.',
        })
      }
      if (!currentLine.includes('start')) {
        suggestions.push({
          label: 'start',
          insertText: 'start: $0',
          kind: CompletionItemKind.Property,
          documentation:
            'The value the sequence starts at if you RESTART or if the sequence hits the MAXVALUE and CYCLE is set.',
        })
      }

      return suggestions
    }
  }

  // MongoDB only
  if (datasourceProvider === 'mongodb') {
    suggestions.push({
      label: 'auto()',
      kind: CompletionItemKind.Function,
      documentation: 'Represents default values that are automatically generated by the database.',
      insertText: 'auto()',
      insertTextFormat: InsertTextFormat.Snippet,
    })
  } else {
    suggestions.push({
      label: 'dbgenerated("")',
      kind: CompletionItemKind.Function,
      documentation:
        'The SQL definition of the default value which is generated by the database. This is not validated by Prisma.',
      insertText: 'dbgenerated("$0")',
      insertTextFormat: InsertTextFormat.Snippet,
    })
  }

  const fieldType = getFieldType(currentLine)
  if (!fieldType) {
    return []
  }

  switch (fieldType) {
    case 'BigInt':
    case 'Int':
      if (datasourceProvider === 'cockroachdb') {
        suggestions.push({
          label: 'sequence()',
          kind: CompletionItemKind.Function,
          documentation:
            'Create a sequence of integers in the underlying database and assign the incremented values to the ID values of the created records based on the sequence.',
        })

        if (fieldType === 'Int') {
          // @default(autoincrement()) is only supported on BigInt fields for cockroachdb.
          break
        }
      }

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

  const modelOrEnum = getModelOrTypeOrEnumBlock(fieldType, lines)
  if (modelOrEnum && modelOrEnum.type === 'enum') {
    // get fields from enum block for suggestions
    const values: string[] = getFieldsFromCurrentBlock(lines, modelOrEnum)
    values.forEach((v) => suggestions.push({ label: v, kind: CompletionItemKind.Value }))
  }

  return suggestions
}

function getSuggestionsForAttribute(
  {
    attribute,
    wordsBeforePosition,
    untrimmedCurrentLine,
    lines,
    block,
    position,
  }: // document,
  {
    attribute?: '@relation'
    wordsBeforePosition: string[]
    untrimmedCurrentLine: string
    lines: string[]
    block: Block
    position: Position
    // document: TextDocument
  }, // eslint-disable-line @typescript-eslint/no-unused-vars
): CompletionList | undefined {
  const firstWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 1]
  const secondWordBeforePosition = wordsBeforePosition[wordsBeforePosition.length - 2]
  const wordBeforePosition = firstWordBeforePosition === '' ? secondWordBeforePosition : firstWordBeforePosition

  let suggestions: CompletionItem[] = []
  // create deep copy with klona
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
      const referencedBlock = getModelOrTypeOrEnumBlock(referencedModelName, lines)
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

    if (isInsideAttribute(untrimmedCurrentLine, position, '[]')) {
      if (isInsideFieldArgument(untrimmedCurrentLine, position)) {
        // extendedIndexes
        if (previewFeatures?.includes('extendedindexes')) {
          let attribute: '@@unique' | '@unique' | '@@id' | '@id' | '@@index' | undefined = undefined

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
          }

          if (attribute) {
            return {
              items: filterSortLengthBasedOnInput(
                attribute,
                previewFeatures,
                datasourceProvider,
                wordBeforePosition,
                sortLengthProperties,
              ),
              isIncomplete: false,
            }
          }
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
    if (wordsBeforePosition.some((a) => a.includes('@@unique'))) {
      blockAtrributeArguments = givenBlockAttributeParams('@@unique')
    } else if (wordsBeforePosition.some((a) => a.includes('@@id'))) {
      blockAtrributeArguments = givenBlockAttributeParams('@@id')
    } else if (wordsBeforePosition.some((a) => a.includes('@@index'))) {
      // Auto completion for Hash and BTree for PostgreSQL
      // includes because `@@index(type: |)` means wordBeforePosition = '@@index(type:'
      // TODO figure out if we need to add cockroachdb provider here
      if (
        datasourceProvider &&
        ['postgresql', 'postgres'].includes(datasourceProvider) &&
        wordBeforePosition.includes('type:')
      ) {
        // TODO move away
        const indexTypeCompletionItems: CompletionItem[] = [
          {
            label: 'Hash',
            kind: CompletionItemKind.Enum,
            insertTextFormat: InsertTextFormat.PlainText,
            documentation: {
              kind: 'markdown',
              value:
                'The Hash index can perform a faster lookup than a B-Tree index. However, the key downside of the Hash index is that its use is limited to equality operators that will perform matching operations.',
            },
          },
          {
            label: 'BTree',
            kind: CompletionItemKind.Enum,
            insertTextFormat: InsertTextFormat.PlainText,
            documentation: {
              kind: 'markdown',
              value:
                "The B-tree index is the default, it creates a self-balanced tree, in other words, it sorts itself. It will maintain its balance throughout operations such as insertions, deletions and searches. Using a B-tree index speeds up scan operations because it doesn't have to scan pages or records sequentially in a linear fashion.",
            },
          },
        ]
        return {
          items: indexTypeCompletionItems,
          isIncomplete: false,
        }
      }

      blockAtrributeArguments = givenBlockAttributeParams('@@index', previewFeatures, datasourceProvider)
    } else if (wordsBeforePosition.some((a) => a.includes('@@fulltext'))) {
      blockAtrributeArguments = givenBlockAttributeParams('@@fulltext')
    }

    if (blockAtrributeArguments.length) {
      suggestions = blockAtrributeArguments
    } else {
      // "@" field attributes
      let fieldAtrributeArguments: CompletionItem[] = []
      if (wordsBeforePosition.some((a) => a.includes('@unique'))) {
        fieldAtrributeArguments = givenFieldAttributeParams(
          '@unique',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      } else if (wordsBeforePosition.some((a) => a.includes('@id'))) {
        fieldAtrributeArguments = givenFieldAttributeParams(
          '@id',
          previewFeatures,
          datasourceProvider,
          wordBeforePosition,
        )
      } else if (wordsBeforePosition.some((a) => a.includes('@@index'))) {
        fieldAtrributeArguments = givenFieldAttributeParams(
          '@@index',
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
  document: TextDocument,
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
