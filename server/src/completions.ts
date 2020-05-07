import {
  CompletionItem,
  CompletionList,
  CompletionItemKind,
  Position,
} from 'vscode-languageserver'
import { Schema, DataSource, Block, Generator } from 'prismafile/dist/ast'
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

function getSuggestionForBlockAttribute(): Array<string> {
  return [
    'map(name: String)',
    'id(fields: Identifier[])',
    'unique(fields: Identifier[], name: String?)',
    'index(fields: Identifier[], name: String?)',
  ]
}

function getSuggestionForFieldAttribute(): Array<string> {
  return [
    'id',
    'unique',
    'map(name: String)',
    'default(expr: Expr)',
    'relation(name?: String, references?: Identifier[], onDelete?: CascadeEnum)',
  ]
}

export function getSuggestionsForAttributes(blockType: string): CompletionList {
  let labels: string[] = []
  switch (blockType) {
    case 'model':
      labels = labels.concat(
        getSuggestionForBlockAttribute(),
        getSuggestionForFieldAttribute(),
      )
      break
    case 'type_alias':
      labels = getSuggestionForFieldAttribute()
      break
  }

  return {
    items: toCompletionItems(labels, CompletionItemKind.Property),
    isIncomplete: true,
  }
}

/**
 * @todo get modelNames except the modelName we are currently in
 */
export function getSuggestionsForTypes(
  ast: Schema,
  foundBlock: Block,
): CompletionList {
  const coreTypes = ['String', 'Int', 'Boolean', 'Float', 'DateTime']
  const relationTypes = ast.blocks
    .filter((block) => block.type === 'model')
    .map((model) => model.name.name)
    .filter((modelName) => modelName != foundBlock.name.name)

  const allowedTypes = coreTypes.concat(relationTypes)

  return {
    items: toCompletionItems(allowedTypes, CompletionItemKind.TypeParameter),
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
  const supportedFields = ['provider', 'output']

  return removeInvalidFieldSuggestions(
    supportedFields,
    block,
    document,
    position,
  )
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
    isIncomplete: true,
  }
}

/**
 * @todo check if position is inside relation not e.g. in List Type
 * @todo exclude field of current line
 */
export function getSuggestionsForRelation(
  blockType: string,
  document: TextDocument,
  position: Position,
): CompletionList | undefined {
  const currentLine = getCurrentLine(document, position.line)
  if (blockType != 'model' || !currentLine.includes('@relation(')) {
    return undefined
  }

  const foundIndexOfFields = currentLine.indexOf('fields:')
  const foundIndexOfReferences = currentLine.indexOf('references:')

  const subString = currentLine.substring(0, position.character - 1)
  if (subString.endsWith('references')) {
    // get identifiers from this block
  } else if (subString.endsWith('fields')) {
    // TODO do stuff here
  }

  return {
    items: toCompletionItems([], CompletionItemKind.Field),
    isIncomplete: true,
  }
}
