import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getCurrentLine, MyBlock } from './MessageHandler'

const corePrimitiveTypes: CompletionItem[] = [
  {
    label: 'String',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Variable length text',
  },
  {
    label: 'Boolean',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'True or false value',
  },
  {
    label: 'Int',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Integer value',
  },
  {
    label: 'Float',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Floating point number',
  },
  {
    label: 'DateTime',
    kind: CompletionItemKind.TypeParameter,
    documentation: 'Timestamp',
  },
]

const allowedBlockTypes: CompletionItem[] = [
  {
    label: 'datasource',
    kind: CompletionItemKind.Class,
    documentation:
      'The datasource block tells the schema where the models are backed.',
  },
  {
    label: 'generator',
    kind: CompletionItemKind.Class,
    documentation:
      "Generator blocks configure which clients are generated and how they're generated. Language preferences and binary configuration will go in here.",
  },
  {
    label: 'model',
    kind: CompletionItemKind.Class,
    documentation:
      'Models represent the entities of your application domain. They are defined using model blocks in the data model. ',
  },
  {
    label: 'type_alias',
    kind: CompletionItemKind.Class,
  },
  {
    label: 'enum',
    kind: CompletionItemKind.Class,
    documentation:
      "Enums are defined via the enum block. You can define enums in your data model if they're supported by the data source you use:\n• PostgreSQL: Supported\n• MySQL: Supported\n• SQLite: Not supported",
  },
]

const blockAttributes: CompletionItem[] = [
  {
    label: 'map([])',
    kind: CompletionItemKind.Property,
    detail: '@@map(_ name: String)',
    documentation:
      'Defines the name of the underlying table or collection name.',
  },
  {
    label: 'id([])',
    kind: CompletionItemKind.Property,
    detail: '@@id(_ fields: Identifier[])',
    documentation: 'Defines a composite primary key across fields.',
  },
  {
    label: 'unique([])',
    kind: CompletionItemKind.Property,
    detail: '@@unique(_ fields: Identifier[], name: String?)',
    documentation: 'Defines a composite unique constraint across fields.',
  },
  {
    label: 'index([])',
    kind: CompletionItemKind.Property,
    detail: '@@index(_ fields: Identifier[], name: String?)',
    documentation: 'Defines an index for multiple fields',
  },
]

const fieldAttributes: CompletionItem[] = [
  {
    label: 'id',
    kind: CompletionItemKind.Property,
    detail: '@id',
    documentation:
      'Defines the primary key. There must be exactly one field @id or block @id',
  },
  {
    label: 'unique',
    kind: CompletionItemKind.Property,
    detail: '@unique',
    documentation: 'Defines the unique constraint.',
  },
  {
    label: 'map()',
    kind: CompletionItemKind.Property,
    detail: '@map(_ name: String)',
    documentation: 'Defines the raw column name the field is mapped to.',
  },
  {
    label: 'default()',
    kind: CompletionItemKind.Property,
    detail: '@default(_ expr: Expr)',
    documentation: 'Specifies a default value if null is provided.',
  },
  {
    label: 'relation()',
    kind: CompletionItemKind.Property,
    detail:
      '@relation(_ name?: String, references?: Identifier[], onDelete?: CascadeEnum)\nArguments:\n•name: (optional, except when required for disambiguation) defines the name of the relationship. The name of the relation needs to be explicitly given to resolve amibiguities when the model contains two or more fields that refer to the same model (another model or itself).\n•references: (optional) list of field names to reference',
    documentation:
      'Specifies and disambiguates relationships when needed. Where possible on relational databases, the @relation annotation will translate to a foreign key constraint, but not an index.',
  },
]

const supportedDataSourceFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation:
      'Can be one of the following built in datasource providers:\n•`postgresql`\n•`mysql`\n•`sqlite`',
  },
  {
    label: 'url',
    kind: CompletionItemKind.Field,
    documentation:
      'Connection URL including authentication info. Each datasource provider documents the URL syntax. Most providers use the syntax provided by the database. (more information see https://github.com/prisma/specs/blob/master/schema/datasource_urls.md)',
  },
]

const supportedGeneratorFields: CompletionItem[] = [
  {
    label: 'provider',
    kind: CompletionItemKind.Field,
    documentation:
      'Can be a path or one of the following built in datasource providers:\n•`prisma-client-js`\n•`prisma-client-go` (This is not implemented yet.)',
  },
  {
    label: 'output',
    kind: CompletionItemKind.Field,
    documentation: 'Path for the generated client.',
  },
  {
    label: 'platforms',
    kind: CompletionItemKind.Field,
    detail: 'Declarative way to download the required binaries.',
    documentation:
      '(optional) An array of binaries that are required by the application, string for known platforms and path for custom binaries.',
  },
  {
    label: 'pinnedPlatform',
    kind: CompletionItemKind.Field,
    detail: 'Declarative way to choose the runtime binary.',
    documentation:
      '(optional) A string that points to the name of an object in the platforms field, usually an environment variable.\nWhen a custom binary is provided the pinnedPlatform is required.',
  },
]

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
  document: TextDocument,
): CompletionItem[] {
  if (blockType !== 'model' && blockType !== 'type_alias') {
    return []
  }
  const currentLine = getCurrentLine(document, position.line)
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
      document,
    ).concat(blockAttributeSuggestions)
  } else {
    // valid schema
    const fieldAttributeSuggestions = getSuggestionForFieldAttribute(
      blockType,
      position,
      document,
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
  document: TextDocument,
  currentModelStartLine: number,
): Array<string> {
  const modelNames: Array<string> = []
  for (let i = 0; i < document.lineCount; i++) {
    if (currentModelStartLine === i) {
      // do not suggest the model name we are currently in
      continue
    }
    const currentLine = getCurrentLine(document, i)
    if (
      (currentLine.includes('model') || currentLine.includes('enum')) &&
      currentLine.includes('{')
    ) {
      // found a block
      const trimmedLine = currentLine.trim()
      const blockType = currentLine.trim().replace(/ .*/, '')
      const blockName = trimmedLine
        .slice(blockType.length, trimmedLine.length - 1)
        .trim()

      modelNames.push(blockName)
      // block is at least 2 lines long
      i++
    }
  }
  return modelNames
}

export function getSuggestionsForTypes(
  foundBlock: MyBlock,
  document: TextDocument,
): CompletionList {
  const suggestions: CompletionItem[] = corePrimitiveTypes

  if (foundBlock instanceof MyBlock) {
    // get all model names
    const modelNames: Array<string> = getAllRelationNamesWithoutAst(
      document,
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
