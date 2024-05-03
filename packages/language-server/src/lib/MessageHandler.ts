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
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

import format from './prisma-schema-wasm/format'
import lint from './prisma-schema-wasm/lint'

import { getCurrentLine } from './ast'

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
import { validateExperimentalFeatures, validateIgnoredBlocks } from './validations'
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

export function handleDiagnosticsRequest(
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): Diagnostic[] {
  const text = document.getText(fullDocumentRange(document))
  const res = lint(text, (errorMessage: string) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  const diagnostics: Diagnostic[] = []
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
    const diagnostic: Diagnostic = {
      range: {
        start: document.positionAt(diag.start),
        end: document.positionAt(diag.end),
      },
      message: previewNotKnownRegex.test(diag.text)
        ? `${diag.text}.\nIf this is unexpected, it might be due to your Prisma VS Code Extension being out of date.`
        : diag.text,
      source: 'Prisma',
    }

    if (diag.is_warning) {
      diagnostic.severity = DiagnosticSeverity.Warning
    } else {
      diagnostic.severity = DiagnosticSeverity.Error
    }
    diagnostics.push(diagnostic)
  }

  validateExperimentalFeatures(document, diagnostics)

  const schema = PrismaSchema.singleFile(document)
  validateIgnoredBlocks(schema, diagnostics)

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(document: TextDocument, params: DeclarationParams): LocationLink[] | undefined {
  const position = params.position

  const schema = PrismaSchema.singleFile(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  // get start position of block
  const results = schema
    .linesAsArray()
    .map(([document, lineNo, line]) => {
      if (
        (line.includes('model') && line.includes(word)) ||
        (line.includes('type') && line.includes(word)) ||
        (line.includes('enum') && line.includes(word))
      ) {
        return [document, lineNo]
      }
    })
    .filter((result) => result !== undefined) as [SchemaDocument, number][]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map(([document, lineNo]) => {
      const block = getBlockAtPosition(document.fileUri, lineNo, schema)
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
      targetUri: foundBlocks[0].definingDocument.fileUri,
      targetRange: foundBlocks[0].range,
      targetSelectionRange: foundBlocks[0].nameRange,
    },
  ]
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export function handleDocumentFormatting(
  params: DocumentFormattingParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): TextEdit[] {
  const formatted = format(document.getText(), params, onError)
  return [TextEdit.replace(fullDocumentRange(document), formatted)]
}

export function handleHoverRequest(document: TextDocument, params: HoverParams): Hover | undefined {
  const position = params.position

  const schema = PrismaSchema.singleFile(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const block = getDatamodelBlock(word, schema)
  if (!block) {
    return
  }

  const blockDocumentation = getDocumentationForBlock(document, block)

  if (blockDocumentation.length !== 0) {
    return {
      contents: blockDocumentation.join('\n\n'),
    }
  }

  // TODO uncomment once https://github.com/prisma/prisma/issues/2546 is resolved!
  /*if (docComments.startsWith('//')) {
    return {
      contents: docComments.slice(3).trim(),
    }
  } */

  return
}

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  params: CompletionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  return prismaSchemaWasmCompletions(params, document, onError) || localCompletions(params, document, onError)
}

export function handleRenameRequest(params: RenameParams, document: TextDocument): WorkspaceEdit | undefined {
  const schema = PrismaSchema.singleFile(document)
  const schemaLines = schema.linesAsArray()
  const position = params.position
  const block = getBlockAtPosition(document.uri, position.line, schema)
  if (!block) {
    return undefined
  }

  const currentLine = block.definingDocument.getLineContent(params.position.line)

  const isDatamodelBlockRename = isDatamodelBlockName(position, block, schema, document)

  const isMappable = ['model', 'enum', 'view'].includes(block.type)
  const needsMap = !isDatamodelBlockRename ? true : isMappable

  const isEnumValueRename: boolean = isEnumValue(currentLine, params.position, block, document)
  const isValidFieldRename: boolean = isValidFieldName(currentLine, params.position, block, document)
  const isRelationFieldRename: boolean = isValidFieldRename && isRelationField(currentLine, schema)

  if (isDatamodelBlockRename || isEnumValueRename || isValidFieldRename) {
    const edits: EditsMap[] = []
    const currentName = extractCurrentName(
      currentLine,
      isDatamodelBlockRename,
      isEnumValueRename,
      isValidFieldRename,
      document,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = block
    let lineOfDefinitionContent = currentLine
    if (isDatamodelBlockRename) {
      // get definition of model or enum
      const matchBlockBeginning = new RegExp(`\\s*(${block.type})\\s+(${currentName})\\s*({)`, 'g')
      const lineOfDefinition = schemaLines.find(([, , l]) => matchBlockBeginning.test(l))
      if (!lineOfDefinition) {
        return
      }
      const [definitionDoc, lineNo, content] = lineOfDefinition
      lineNumberOfDefinition = lineNo
      lineOfDefinitionContent = content
      const definitionBlockAtPosition = getBlockAtPosition(definitionDoc.fileUri, lineNumberOfDefinition, schema)
      if (!definitionBlockAtPosition) {
        return
      }
      blockOfDefinition = definitionBlockAtPosition
    }

    // rename marked string
    edits.push(insertBasicRename(params.newName, currentName, document, lineNumberOfDefinition))

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
  params: CodeActionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CodeAction[] {
  if (!params.context.diagnostics.length) {
    return []
  }

  return quickFix(document, params, onError)
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
