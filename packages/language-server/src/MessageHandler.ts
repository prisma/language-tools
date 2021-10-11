import {
  DocumentFormattingParams,
  TextEdit,
  Range,
  Location,
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
} from 'vscode-languageserver'
import {
  Block,
  convertDocumentTextToTrimmedLineArray,
  fullDocumentRange,
  getBlockAtPosition,
  getCurrentLine,
  getExperimentalFeaturesRange,
  getModelOrEnumBlock,
  getWordAtPosition,
  isFirstInsideBlock,
} from './util'
import { TextDocument } from 'vscode-languageserver-textdocument'
import format from './prisma-fmt/format'
import {
  getSuggestionForFieldAttribute,
  getSuggestionsForTypes,
  getSuggestionForBlockTypes,
  getSuggestionForFirstInsideBlock,
  getSuggestionForSupportedFields,
  getSuggestionsForInsideAttributes,
  positionIsAfterFieldAndType,
  isInsideAttribute,
  getSymbolBeforePosition,
  suggestEqualSymbol,
  getSuggestionForNativeTypes,
} from './completion/completions'
import { quickFix } from './codeActionProvider'
import lint from './prisma-fmt/lint'
import {
  isModelName,
  insertBasicRename,
  renameReferencesForModelName,
  isEnumValue,
  renameReferencesForEnumValue,
  isValidFieldName,
  extractCurrentName,
  mapExistsAlready,
  insertMapAttribute,
  renameReferencesForFieldValue,
  isEnumName,
  printLogMessage,
  isRelationField,
} from './rename/renameUtil'

export function handleDiagnosticsRequest(
  document: TextDocument,
  binPath: string,
  onError?: (errorMessage: string) => void,
): Diagnostic[] {
  const text = document.getText(fullDocumentRange(document))
  const res = lint(text, (errorMessage: any) => {
    if (onError) {
      onError(errorMessage)
    }
  })

  const diagnostics: Diagnostic[] = []
  if (
    res.some(
      (diagnostic) =>
        diagnostic.text === "Field declarations don't require a `:`." ||
        diagnostic.text ===
          'Model declarations have to be indicated with the `model` keyword.',
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
  if (document.getText().includes('experimentalFeatures')) {
    const experimentalFeaturesRange: Range | undefined =
      getExperimentalFeaturesRange(document)
    if (experimentalFeaturesRange) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: experimentalFeaturesRange,
        message:
          "This property has been renamed to 'previewFeatures' to better communicate what they are.",
        source: '',
      })
    }
  }

  return diagnostics
}

/**
 * @todo Use official schema.prisma parser. This is a workaround!
 */
export function handleDefinitionRequest(
  document: TextDocument,
  params: DeclarationParams,
): Location | undefined {
  const textDocument = params.textDocument
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  // get start position of model type
  const results: number[] = lines
    .map((line, index) => {
      if (
        (line.includes('model') && line.includes(word)) ||
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
      if (block && block.name === word) {
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

  const startPosition = {
    line: foundBlocks[0].start.line,
    character: foundBlocks[0].start.character,
  }
  const endPosition = {
    line: foundBlocks[0].end.line,
    character: foundBlocks[0].end.character,
  }

  return {
    uri: textDocument.uri,
    range: Range.create(startPosition, endPosition),
  }
}

/**
 * This handler provides the modification to the document to be formatted.
 */
export function handleDocumentFormatting(
  params: DocumentFormattingParams,
  document: TextDocument,
  binPath: string,
  onError?: (errorMessage: string) => void,
): TextEdit[] {
  const formatted = format(document.getText(), onError)
  return [TextEdit.replace(fullDocumentRange(document), formatted)]
}

export function handleHoverRequest(
  document: TextDocument,
  params: HoverParams,
): Hover | undefined {
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const word = getWordAtPosition(document, position)

  if (word === '') {
    return
  }

  const foundBlock = getModelOrEnumBlock(word, lines)
  if (!foundBlock) {
    return
  }

  const commentLine = foundBlock.start.line - 1
  const docComments = document.getText({
    start: { line: commentLine, character: 0 },
    end: { line: commentLine, character: Number.MAX_SAFE_INTEGER },
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

/**
 *
 * This handler provides the initial list of the completion items.
 */
export function handleCompletionRequest(
  params: CompletionParams,
  document: TextDocument,
  binPath: string,
): CompletionList | undefined {
  const context = params.context
  const position = params.position

  const lines = convertDocumentTextToTrimmedLineArray(document)
  const currentLineUntrimmed = getCurrentLine(document, position.line)
  const currentLineTillPosition = currentLineUntrimmed
    .slice(0, position.character - 1)
    .trim()
  const wordsBeforePosition: string[] = currentLineTillPosition.split(/\s+/)

  const symbolBeforePosition = getSymbolBeforePosition(document, position)
  const symbolBeforePositionIsWhiteSpace =
    symbolBeforePosition.search(/\s/) !== -1

  const positionIsAfterArray: boolean =
    wordsBeforePosition.length >= 3 &&
    !currentLineTillPosition.includes('[') &&
    symbolBeforePositionIsWhiteSpace

  // datasource, generator, model or enum
  const foundBlock = getBlockAtPosition(position.line, lines)
  if (!foundBlock) {
    if (
      wordsBeforePosition.length > 1 ||
      (wordsBeforePosition.length === 1 && symbolBeforePositionIsWhiteSpace)
    ) {
      return
    }
    return getSuggestionForBlockTypes(lines)
  }

  if (isFirstInsideBlock(position, getCurrentLine(document, position.line))) {
    return getSuggestionForFirstInsideBlock(
      foundBlock.type,
      lines,
      position,
      foundBlock,
    )
  }

  // Completion was triggered by a triggerCharacter
  // triggerCharacters defined in src/server.ts
  if (context?.triggerKind === CompletionTriggerKind.TriggerCharacter) {
    switch (context.triggerCharacter as '@' | '"' | '.') {
      case '@':
        if (
          !positionIsAfterFieldAndType(position, document, wordsBeforePosition)
        ) {
          return
        }
        return getSuggestionForFieldAttribute(
          foundBlock,
          getCurrentLine(document, position.line),
          lines,
          wordsBeforePosition,
          document,
          binPath,
        )
      case '"':
        return getSuggestionForSupportedFields(
          foundBlock.type,
          lines[position.line],
          currentLineUntrimmed,
          position,
          binPath,
        )
      case '.':
        return getSuggestionForNativeTypes(
          foundBlock,
          wordsBeforePosition,
          document,
          binPath,
          lines,
        )
    }
  }

  switch (foundBlock.type) {
    case 'model':
      // check if inside attribute
      if (isInsideAttribute(currentLineUntrimmed, position, '()')) {
        return getSuggestionsForInsideAttributes(
          currentLineUntrimmed,
          lines,
          document,
          position,
          foundBlock,
          binPath,
        )
      }
      // check if type
      if (
        !positionIsAfterFieldAndType(position, document, wordsBeforePosition)
      ) {
        return getSuggestionsForTypes(
          foundBlock,
          lines,
          position,
          currentLineUntrimmed,
        )
      }
      return getSuggestionForFieldAttribute(
        foundBlock,
        lines[position.line],
        lines,
        wordsBeforePosition,
        document,
        binPath,
      )
    case 'datasource':
    case 'generator':
      if (
        wordsBeforePosition.length === 1 &&
        symbolBeforePositionIsWhiteSpace
      ) {
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
          binPath,
        )
      }
      break
    case 'enum':
      break
  }
}

export function handleRenameRequest(
  params: RenameParams,
  document: TextDocument,
): WorkspaceEdit | undefined {
  const lines: string[] = convertDocumentTextToTrimmedLineArray(document)
  const position = params.position
  const currentLine: string = lines[position.line]
  const currentBlock = getBlockAtPosition(position.line, lines)
  const edits: TextEdit[] = []
  if (!currentBlock) {
    return
  }

  const isModelRename: boolean = isModelName(
    params.position,
    currentBlock,
    lines,
    document,
  )
  const isEnumRename: boolean = isEnumName(
    params.position,
    currentBlock,
    lines,
    document,
  )
  const isEnumValueRename: boolean = isEnumValue(
    currentLine,
    params.position,
    currentBlock,
    document,
  )
  const isValidFieldRename: boolean = isValidFieldName(
    currentLine,
    params.position,
    currentBlock,
    document,
  )
  const isRelationFieldRename: boolean =
    isValidFieldRename && isRelationField(currentLine, lines)

  if (
    isModelRename ||
    isEnumRename ||
    isEnumValueRename ||
    isValidFieldRename
  ) {
    const currentName = extractCurrentName(
      currentLine,
      isModelRename || isEnumRename,
      isEnumValueRename,
      isValidFieldRename,
      document,
      params.position,
    )

    let lineNumberOfDefinition = position.line
    let blockOfDefinition = currentBlock
    let lineOfDefinition = currentLine
    if (isModelRename || isEnumRename) {
      // get definition of model or enum
      const matchModelOrEnumBlockBeginning = new RegExp(
        `\\s*(model|enum)\\s+(${currentName})\\s*({)`,
        'g',
      )
      lineNumberOfDefinition = lines.findIndex((l) =>
        matchModelOrEnumBlockBeginning.test(l),
      )
      if (lineNumberOfDefinition === -1) {
        return
      }
      lineOfDefinition = lines[lineNumberOfDefinition]
      const definitionBlockAtPosition = getBlockAtPosition(
        lineNumberOfDefinition,
        lines,
      )
      if (!definitionBlockAtPosition) {
        return
      }
      blockOfDefinition = definitionBlockAtPosition
    }

    // rename marked string
    edits.push(
      insertBasicRename(
        params.newName,
        currentName,
        document,
        lineNumberOfDefinition,
      ),
    )

    // check if map exists already
    if (
      !isRelationFieldRename &&
      !mapExistsAlready(
        lineOfDefinition,
        lines,
        blockOfDefinition,
        isModelRename || isEnumRename,
      )
    ) {
      // add map attribute
      edits.push(
        insertMapAttribute(
          currentName,
          position,
          blockOfDefinition,
          isModelRename || isEnumRename,
        ),
      )
    }

    // rename references
    if (isModelRename || isEnumRename) {
      edits.push(
        ...renameReferencesForModelName(
          currentName,
          params.newName,
          document,
          lines,
        ),
      )
    } else if (isEnumValueRename) {
      edits.push(
        ...renameReferencesForEnumValue(
          currentName,
          params.newName,
          document,
          lines,
          blockOfDefinition.name,
        ),
      )
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
      isEnumRename,
      isModelRename,
      isValidFieldRename,
      isEnumValueRename,
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
export function handleCompletionResolveRequest(
  item: CompletionItem,
): CompletionItem {
  return item
}

export function handleCodeActions(
  params: CodeActionParams,
  document: TextDocument,
): CodeAction[] {
  if (!params.context.diagnostics.length) {
    return []
  }

  return quickFix(document, params)
}
