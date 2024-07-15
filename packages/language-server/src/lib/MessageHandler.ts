import {
  DocumentFormattingParams,
  TextEdit,
  DeclarationParams,
  CompletionParams,
  CompletionList,
  CompletionItem,
  HoverParams,
  Hover,
  CodeActionParams,
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  RenameParams,
  WorkspaceEdit,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  LocationLink,
  ReferenceParams,
  Location,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import format from './prisma-schema-wasm/format'
import lint from './prisma-schema-wasm/lint'

import { quickFix } from './code-actions'
import {
  insertBasicRename,
  renameReferencesForModelName,
  isEnumValue,
  renameReferencesForEnumValue,
  isValidFieldName,
  extractCurrentName,
  mapExistsAlready,
  insertMapAttribute,
  renameReferencesForFieldName,
  printLogMessage,
  isRelationField,
  isDatamodelBlockName,
  EditsMap,
  mergeEditMaps,
} from './code-actions/rename'
import { validateIgnoredBlocks } from './validations'
import {
  fullDocumentRange,
  getWordAtPosition,
  getBlockAtPosition,
  Block,
  getBlocks,
  getDocumentationForBlock,
  getDatamodelBlock,
} from './ast'
import { prismaSchemaWasmCompletions, localCompletions } from './completions'
import { PrismaSchema, SchemaDocument } from './Schema'
import { DiagnosticMap } from './DiagnosticMap'
import references from './prisma-schema-wasm/references'
import hover from './prisma-schema-wasm/hover'

export function handleDiagnosticsRequest(
  schema: PrismaSchema,
  onError?: (errorMessage: string) => void,
): DiagnosticMap {
  const res = lint(schema, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  const diagnostics = new DiagnosticMap(schema.documents.map((doc) => doc.uri))
  if (
    res.some(
      (diagnostic) =>
        diagnostic.text === "Field declarations don't require a `:`." ||
        diagnostic.text === 'Model declarations have to be indicated with the `model` keyword.',
    )
  ) {
    if (onError) {
      onError(
        "You might currently be viewing a Prisma 1 datamodel which is based on the GraphQL syntax. The current Prisma Language Server doesn't support this syntax. If you are handling a Prisma 1 datamodel, please change the file extension to `.graphql` so the new Prisma Language Server does not get triggered anymore.",
      )
    }
  }

  for (const diag of res) {
    const previewNotKnownRegex = /The preview feature \"[a-zA-Z]+\" is not known/
    const uri = diag.file_name
    const document = schema.findDocByUri(uri)
    if (!document) {
      continue
    }
    const diagnostic: Diagnostic = {
      range: {
        start: document.positionAt(diag.start),
        end: document.positionAt(diag.end),
      },
      message: previewNotKnownRegex.test(diag.text)
        ? `${diag.text}.\nIf this is unexpected, it might be due to your editor's Prisma Extension being out of date.`
        : diag.text,
      source: 'Prisma',
    }

    if (diag.is_warning) {
      diagnostic.severity = DiagnosticSeverity.Warning
    } else {
      diagnostic.severity = DiagnosticSeverity.Error
    }
    diagnostics.add(uri, diagnostic)
  }

  validateIgnoredBlocks(schema, diagnostics)

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: DeclarationParams,
): LocationLink[] | undefined {
  const position = params.position

  const word = getWordAtPosition(initiatingDocument, position)

  if (word === '') {
    return
  }

  // get start position of block
  const results = schema
    .linesAsArray()
    .map(({ document, lineIndex, text }) => {
      if (
        (text.includes('model') && text.includes(word)) ||
        (text.includes('type') && text.includes(word)) ||
        (text.includes('enum') && text.includes(word))
      ) {
        return [document, lineIndex]
      }
    })
    .filter((result) => result !== undefined) as [SchemaDocument, number][]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map(([document, lineNo]) => {
      const block = getBlockAtPosition(document.uri, lineNo, schema)
      if (block && block.name === word && block.range.start.line === lineNo) {
        return block
      }
    })
    .filter((block) => block !== undefined) as Block[]

  if (foundBlocks.length !== 1) {
    return
  }

  if (!foundBlocks[0]) {
    return
  }

  return [
    {
      targetUri: foundBlocks[0].definingDocument.uri,
      targetRange: foundBlocks[0].range,
      targetSelectionRange: foundBlocks[0].nameRange,
    },
  ]
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export function handleDocumentFormatting(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: DocumentFormattingParams,
  onError?: (errorMessage: string) => void,
): TextEdit[] {
  const formatted = format(schema, initiatingDocument, params, onError)
  return [TextEdit.replace(fullDocumentRange(initiatingDocument), formatted)]
}

export function handleHoverRequest(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: HoverParams,
  onError?: (errorMessage: string) => void,
): Hover | undefined {
  return hover(schema, initiatingDocument, params, onError)
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  schema: PrismaSchema,
  document: TextDocument,
  params: CompletionParams,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  return prismaSchemaWasmCompletions(schema, params, onError) || localCompletions(schema, document, params, onError)
}

export function handleReferencesRequest(
  schema: PrismaSchema,
  params: ReferenceParams,
  onError?: (errorMessage: string) => void,
): Location[] | undefined {
  return references(schema, params, onError)
}

export function handleRenameRequest(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: RenameParams,
): WorkspaceEdit | undefined {
  const schemaLines = schema.linesAsArray()
  const position = params.position
  const block = getBlockAtPosition(initiatingDocument.uri, position.line, schema)
  if (!block) {
    return undefined
  }

  const currentLine = block.definingDocument.lines[params.position.line].text

  const isDatamodelBlockRename = isDatamodelBlockName(position, block, schema, initiatingDocument)

  const isMappable = ['model', 'enum', 'view'].includes(block.type)
  const needsMap = !isDatamodelBlockRename ? true : isMappable

  const isEnumValueRename: boolean = isEnumValue(currentLine, params.position, block, initiatingDocument)
  const isValidFieldRename: boolean = isValidFieldName(currentLine, params.position, block, initiatingDocument)
  const isRelationFieldRename: boolean = isValidFieldRename && isRelationField(currentLine, schema)

  if (isDatamodelBlockRename || isEnumValueRename || isValidFieldRename) {
    const edits: EditsMap[] = []
    const currentName = extractCurrentName(
      currentLine,
      isDatamodelBlockRename,
      isEnumValueRename,
      isValidFieldRename,
      initiatingDocument,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = block
    let lineOfDefinitionContent = currentLine
    if (isDatamodelBlockRename) {
      // get definition of model or enum
      const matchBlockBeginning = new RegExp(`\\s*(${block.type})\\s+(${currentName})\\s*({)`, 'g')
      const lineOfDefinition = schemaLines.find((line) => matchBlockBeginning.test(line.text))
      if (!lineOfDefinition) {
        return
      }
      const { document: definitionDoc, lineIndex, text } = lineOfDefinition
      lineNumberOfDefinition = lineIndex
      lineOfDefinitionContent = text
      const definitionBlockAtPosition = getBlockAtPosition(definitionDoc.uri, lineNumberOfDefinition, schema)
      if (!definitionBlockAtPosition) {
        return
      }
      blockOfDefinition = definitionBlockAtPosition
    }

    // rename marked string
    edits.push(insertBasicRename(params.newName, currentName, initiatingDocument, lineNumberOfDefinition))

    // check if map exists already
    if (
      !isRelationFieldRename &&
      !mapExistsAlready(lineOfDefinitionContent, schema, blockOfDefinition, isDatamodelBlockRename) &&
      needsMap
    ) {
      // add map attribute
      edits.push(insertMapAttribute(currentName, position, blockOfDefinition, isDatamodelBlockRename))
    }

    // rename references
    if (isDatamodelBlockRename) {
      edits.push(renameReferencesForModelName(currentName, params.newName, schema))
    } else if (isEnumValueRename) {
      edits.push(renameReferencesForEnumValue(currentName, params.newName, schema, blockOfDefinition.name))
    } else if (isValidFieldRename) {
      edits.push(
        renameReferencesForFieldName(currentName, params.newName, schema, blockOfDefinition, isRelationFieldRename),
      )
    }

    printLogMessage(
      currentName,
      params.newName,
      isDatamodelBlockRename,
      isValidFieldRename,
      isEnumValueRename,
      block.type,
    )

    return {
      changes: mergeEditMaps(edits),
    }
  }

  return
}

/**
 *
 * @param item This handler resolves additional information for the item selected in the completion list.
 */
export function handleCompletionResolveRequest(item: CompletionItem): CompletionItem {
  return item
}

export function handleCodeActions(
  schema: PrismaSchema,
  initiatingDocument: TextDocument,
  params: CodeActionParams,
  onError?: (errorMessage: string) => void,
): CodeAction[] {
  if (!params.context.diagnostics.length) {
    return []
  }

  return quickFix(schema, initiatingDocument, params, onError)
}

export function handleDocumentSymbol(params: DocumentSymbolParams, document: TextDocument): DocumentSymbol[] {
  const schema = PrismaSchema.singleFile(document)
  return Array.from(getBlocks(schema), (block) => ({
    kind: {
      model: SymbolKind.Class,
      enum: SymbolKind.Enum,
      type: SymbolKind.Interface,
      view: SymbolKind.Class,
      datasource: SymbolKind.Struct,
      generator: SymbolKind.Function,
    }[block.type],
    name: block.name,
    range: block.range,
    selectionRange: block.nameRange,
  }))
}
