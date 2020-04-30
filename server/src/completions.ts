import {
  CompletionItem,
  Position,
  CompletionList,
  CompletionItemKind,
} from 'vscode-languageserver'
import { Schema, DataSource, Block } from 'prismafile/dist/ast'

/**
 * @todo check if in 'embed' blocks
 */
function getSuggestionForBlockAttribute(block: Block): Array<string> {
  if(block.type != 'model') {
    return []
  }
  return [
    'map(_ name: String)',
    'id(_ fields: Identifier[])',
    'unique(_ fields: Identifier[], name: String?)',
    'index(_ fields: Identifier[], name: String?)',
  ]
}

/**
 *
 * @todo check if in 'embed' block
 */
function getSuggestionForFieldAttribute(block: Block): Array<string> {
  if (block.type != 'model' && block.type != 'type_alias') {
    return []
  }
  return [
    'id',
    'unique',
    'map(_ name: String)',
    'default(_expr: Expr)',
    'relation(_ name?:String, references?: Identifier[], onDelete?: CascadeEnum)',
  ]
}

export function getSuggestionsForAttributes(token: string, block: Block): CompletionList {
  const labels = token.startsWith('@@')
    ? getSuggestionForBlockAttribute(block)
    : getSuggestionForFieldAttribute(block)
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
export function getSuggestionsForTypes(ast: Schema, foundBlock: Block): CompletionList {
  const coreTypes = ['String', 'Int', 'Boolean', 'Float', 'DateTime']
  const relationTypes = ast.blocks
  .filter( block => block.type === 'model')
  .map(model => model.name)
  .filter(modelName => modelName != foundBlock.name)

  let allowedTypes = coreTypes.concat(relationTypes)
  
  const items: CompletionItem[] = []
  allowedTypes.forEach((type) =>
    items.push({ label: type, kind: CompletionItemKind.TypeParameter}),
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
