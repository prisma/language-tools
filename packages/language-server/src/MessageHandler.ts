import {
  DocumentFormattingParams,
  TextEdit,
  Range,
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
  CompletionTriggerKind,
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  LocationLink,
} from 'vscode-languageserver'
import {
  Block,
  convertDocumentTextToTrimmedLineArray,
  fullDocumentRange,
  getBlockAtPosition,
  getCurrentLine,
  getExperimentalFeaturesRange,
  getModelOrTypeOrEnumOrViewBlock,
  getWordAtPosition,
  isFirstInsideBlock,
  positionIsAfterFieldAndType,
  isInsideAttribute,
  getSymbolBeforePosition,
  getBlocks,
  MAX_SAFE_VALUE_i32,
} from './util'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import format from './prisma-schema-wasm/format'
import textDocumentCompletion from './prisma-schema-wasm/textDocumentCompletion'
import {
  getSuggestionForFieldAttribute,
  getSuggestionsForFieldTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideRoundBrackets,
  suggestEqualSymbol,
  getSuggestionForNativeTypes,
} from './completion/completions'
import { quickFix } from './codeActionProvider'
import lint from './prisma-schema-wasm/lint'
import {
  insertBasicRename,
  renameReferencesForModelName,
  isEnumValue,
  renameReferencesForEnumValue,
  isValidFieldName,
  extractCurrentName,
  mapExistsAlready,
  insertMapAttribute,
  renameReferencesForFieldValue,
  printLogMessage,
  isRelationField,
  isBlockName,
} from './rename/renameUtil'
import { createDiagnosticsForIgnore } from './diagnosticsHandler'

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
    const diagnostic: Diagnostic = {
      range: {
        start: document.positionAt(diag.start),
        end: document.positionAt(diag.end),
      },
      message: diag.text,
      source: '',
    }
    if (diag.is_warning) {
      diagnostic.severity = DiagnosticSeverity.Warning
    } else {
      diagnostic.severity = DiagnosticSeverity.Error
    }
    diagnostics.push(diagnostic)
  }

  // TODO can be removed? Since it was renamed to `previewFeatures`
  // check for experimentalFeatures inside generator block
  // Related code in codeActionProvider.ts, around lines 185-204
  if (document.getText().includes('experimentalFeatures')) {
    const experimentalFeaturesRange: Range | undefined = getExperimentalFeaturesRange(document)
    if (experimentalFeaturesRange) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: experimentalFeaturesRange,
        message:
          "The `experimentalFeatures` property is obsolete and has been renamed to 'previewFeatures' to better communicate what it is.",
        code: 'Prisma 5',
        tags: [2],
      })
    }
  }

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const diagnosticsForIgnore = createDiagnosticsForIgnore(lines)
  diagnostics.push(...diagnosticsForIgnore)

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(document: TextDocument, params: DeclarationParams): LocationLink[] | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  // get start position of block
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(word)) ||
        (line.includes('type') && line.includes(word)) ||
        (line.includes('enum') && line.includes(word))
      ) {
        return index
      }
    })
    .filter((index) => index !== undefined) as number[]

  if (results.length === 0) {
    return
  }

  const foundBlocks: Block[] = results
    .map((result) => {
      const block = getBlockAtPosition(result, lines)
      if (block && block.name === word && block.range.start.line === result) {
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
      targetUri: textDocument.uri,
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

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrTypeOrEnumOrViewBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const commentLine = foundBlock.range.start.line - 1
  const docComments = document.getText({
    start: { line: commentLine, character: 0 },
    end: { line: commentLine, character: MAX_SAFE_VALUE_i32 },
  })
  if (docComments.startsWith('///')) {
    return {
      contents: docComments.slice(4).trim(),
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

function prismaSchemaWasmCompletions(
  params: CompletionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const text = document.getText(fullDocumentRange(document))

  const completionList = textDocumentCompletion(text, params, (errorMessage: string) => {
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

function localCompletions(
  params: CompletionParams,
  document: TextDocument,
  onError?: (errorMessage: string) => void,
): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const currentLineTillPosition = currentLineUntrimmed.slice(0, position.character - 1).trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforePositionIsWhiteSpace = symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 && !currentLineTillPosition.includes('[') && symbolBeforePositionIsWhiteSpace

  // datasource, generator, model, type or enum
  const foundBlock = getBlockAtPosition(position.line, lines)
  if (!foundBlock) {
    if (wordsBeforePosition.length > 1 || (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)) {
      return
    }
    return getSuggestionForBlockTypes(lines)
  }

  if (isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
    return getSuggestionForFirstInsideBlock(foundBlock.type, lines, position, foundBlock)
  }

  // Completion was triggered by a triggerCharacter
  // triggerCharacters defined in src/server.ts
  if (context?.triggerKind === CompletionTriggerKind.TriggerCharacter) {
    switch (context.triggerCharacter as '@' | '"' | '.') {
      case '@':
        if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(document, position.line),
          lines,
          wordsBeforePosition,
          document,
          onError,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          lines,
          onError,
        )
      case '.':
        // check if inside attribute
        // Useful to complete composite types
        if (['model', 'view'].includes(foundBlock.type) && isInsideAttribute(currentLineUntrimmed, position, '()')) {
          return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, position, foundBlock)
        } else {
          return getSuggestionForNativeTypes(foundBlock, lines, wordsBeforePosition, document, onError)
        }
    }
  }

  switch (foundBlock.type) {
    case 'model':
    case 'view':
    case 'type':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideRoundBrackets(currentLineUntrimmed, lines, position, foundBlock)
      }
      // check if field type
      if (!positionIsAfterFieldAndType(position, document, wordsBeforePosition)) {
        return getSuggestionsForFieldTypes(foundBlock, lines, position, currentLineUntrimmed)
      }
      return getSuggestionForFieldAttribute(
        foundBlock,
        lines[position.line],
        lines,
        wordsBeforePosition,
        document,
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
          lines[position.line],
          currentLineUntrimmed,
          position,
          lines,
          onError,
        )
      }
      break
    case 'enum':
      break
  }
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
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  const position = params.position
  const currentLine: string = lines[position.line]
  const currentBlock = getBlockAtPosition(position.line, lines)
  if (!currentBlock) {
    return
  }

  const isBlockRename =
    isBlockName(position, currentBlock, lines, document, 'model') ||
    isBlockName(position, currentBlock, lines, document, 'enum') ||
    isBlockName(position, currentBlock, lines, document, 'view') ||
    isBlockName(position, currentBlock, lines, document, 'type')

  const isMappable = currentBlock.type === 'model' || currentBlock.type === 'enum' || currentBlock.type === 'view'
  const needsMap = !isBlockRename ? true : isMappable

  const isEnumValueRename: boolean = isEnumValue(currentLine, params.position, currentBlock, document)
  const isValidFieldRename: boolean = isValidFieldName(currentLine, params.position, currentBlock, document)
  const isRelationFieldRename: boolean = isValidFieldRename && isRelationField(currentLine, lines)

  if (isBlockRename || isEnumValueRename || isValidFieldRename) {
    const edits: TextEdit[] = []
    const currentName = extractCurrentName(
      currentLine,
      isBlockRename,
      isEnumValueRename,
      isValidFieldRename,
      document,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = currentBlock
    let lineOfDefinition = currentLine
    if (isBlockRename) {
      // get definition of model or enum
      const matchBlockBeginning = new RegExp(`\\s*(${currentBlock.type})\\s+(${currentName})\\s*({)`, 'g')
      lineNumberOfDefinition = lines.findIndex((l) => matchBlockBeginning.test(l))
      if (lineNumberOfDefinition === -1) {
        return
      }
      lineOfDefinition = lines[lineNumberOfDefinition]
      const definitionBlockAtPosition = getBlockAtPosition(lineNumberOfDefinition, lines)
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
      !mapExistsAlready(lineOfDefinition, lines, blockOfDefinition, isBlockRename) &&
      needsMap
    ) {
      // add map attribute
      edits.push(insertMapAttribute(currentName, position, blockOfDefinition, isBlockRename))
    }

    // rename references
    if (isBlockRename) {
      edits.push(...renameReferencesForModelName(currentName, params.newName, document, lines))
    } else if (isEnumValueRename) {
      edits.push(...renameReferencesForEnumValue(currentName, params.newName, document, lines, blockOfDefinition.name))
    } else if (isValidFieldRename) {
      edits.push(
        ...renameReferencesForFieldValue(
          currentName,
          params.newName,
          document,
          lines,
          blockOfDefinition,
          isRelationFieldRename,
        ),
      )
    }

    printLogMessage(
      currentName,
      params.newName,
      isBlockRename,
      isValidFieldRename,
      isEnumValueRename,
      currentBlock.type,
    )
    return {
      changes: {
        [document.uri]: edits,
      },
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
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  return Array.from(getBlocks(lines), (block) => ({
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