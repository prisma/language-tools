import {
  CompletionItem,
  Position,
  CompletionList,
  CompletionItemKind,
} from 'vscode-languageserver'
import { Schema, DataSource, Block } from 'prismafile/dist/ast'

/**
 * @todo check if in 'model' or 'embed' blocks
 */
function getSuggestionForBlockAttribute(): Array<string> {
  return [
    'map(_ name: String)',
    'id(_ fields: Identifier[])',
    'unique(_ fields: Identifier[], name: String?)',
    'index(_ fields: Identifier[], name: String?)',
  ]
}

/**
 *
 * @todo check if in 'model', 'embed' blocks or in 'type' definition
 */
function getSuggestionForFieldAttribute(): Array<string> {
  return [
    'id',
    'unique',
    'map(_ name: String)',
    'default(_expr: Expr)',
    'relation(_ name?:String, references?: Identifier[], onDelete?: CascadeEnum)',
  ]
}

export function getSuggestionsForAttributes(token: string): CompletionList {
  const labels = token.startsWith('@@')
    ? getSuggestionForBlockAttribute()
    : getSuggestionForFieldAttribute()
  const items: CompletionItem[] = []
  labels.forEach((l) =>
    items.push({ label: l, kind: CompletionItemKind.Property }),
  )
  return {
    items: items,
    isIncomplete: true,
  }
}

/**
 * @todo get modelNames except the modelName we are currently in
 */
export function getSuggestionsForTypes(): CompletionList {
  const coreTypes = ['String', 'Int', 'Boolean', 'Float', 'DateTime']
  const items: CompletionItem[] = []
  coreTypes.forEach((type) =>
    items.push({ label: type, kind: CompletionItemKind.TypeParameter }),
  )
  return {
    items: items,
    isIncomplete: false,
  }
}

/**
 * 
 * @todo add enum once supported!
 */
export function getSuggestionForBlockTypes(ast: Schema): CompletionList {
  let allowedBlockTypes = ["datasource", "generator", "model", "type_alias"]

  let existingBlockTypes = ast.blocks
  .map(block => block.type.toString())
  .filter(type => type === 'datasource' || type === 'generator')

  existingBlockTypes.forEach(toRemove => {
    let index = allowedBlockTypes.indexOf(toRemove)
    allowedBlockTypes.splice(index, 1)
  })

  const items: CompletionItem[] = []
  allowedBlockTypes.forEach((type) =>
    items.push({ label: type, kind: CompletionItemKind.Class }),
  )
  return {
    items: items,
    isIncomplete: true,
  }
}
