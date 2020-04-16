import {
  TextDocumentPositionParams,
  CancellationToken,
  TextDocuments,
  DocumentFormattingParams,
  TextEdit,
  Hover,
  Range,
  TypeDefinitionParams,
  Location,
  DeclarationParams,
} from 'vscode-languageserver'
import * as util from './util'
import { fullDocumentRange } from './provider'
import { getDMMF } from '@prisma/sdk'
import * as fs from 'fs'
import { TextDocument, Position } from 'vscode-languageserver-textdocument'
import format from './format'
import install from './install'

export class MessageHandler {
  constructor() { }

  async handleHoverRequest(
    params: TextDocumentPositionParams,
    documents: TextDocuments<TextDocument>,
  ) {
    return null;
  }

  getWordAtPosition(document: TextDocument, position: Position): String {
    let currentLine = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: 9999 },
    })
    var beginning = currentLine.slice(0, position.character + 1).search(/\S+$/)
    var end = currentLine.slice(position.character).search(/\W/)
    if (end < 0) {
      return ''
    }
    return currentLine.slice(beginning, end + position.character)
  }

  async handleDefinitionRequest(documents: TextDocuments<TextDocument>,
    params: DeclarationParams,
    _token?: CancellationToken,
  ): Promise<Location> {
    // bad workaround! 
    // ASTNode will be necessary to handle this a lot better

    const textDocument = params.textDocument
    const position = params.position

    const document = documents.get(textDocument.uri)

    const documentText = document?.getText()

    if (!document || !documentText) {
      return new Promise(resolve => resolve())
    }

    let word = this.getWordAtPosition(document, position);
    if (word == '') {
      return new Promise(resolve => resolve())
    }

    // parse schem file to datamodel meta format (DMMF)
    const dmmf = await getDMMF({ datamodel: documentText })

    let modelName = dmmf.datamodel.models
      .map(model => model.name)
      ?.find(name => name == word)

    // selected word is not a model type
    if (modelName == null) {
      return new Promise(resolve => resolve())
    }

    let modelDefinition = "model ";
    // get start position of model type
    let index = documentText.indexOf(modelDefinition + modelName)
    const EOL = '\n';
    const buf = documentText.slice(0, index);
    const lines = buf.split(EOL).length - 1;
    const lastLineIndex = buf.lastIndexOf(EOL);
    const startPosition = { line: lines, character: (index + modelDefinition.length - lastLineIndex - 1) }
    const endPosition = { line: lines, character: (index + modelDefinition.length - lastLineIndex - 1 + modelName.length) }

    return {
      uri: textDocument.uri,
      range: Range.create(startPosition, endPosition)
    }

  }

  async handleDocumentFormatting(
    params: DocumentFormattingParams,
    documents: TextDocuments<TextDocument>,
  ): Promise<TextEdit[]> {
    let options = params.options
    const document = documents.get(params.textDocument.uri)
    if (document == null) {
      return []
    }
    const binPath = await util.getBinPath()
    if (!fs.existsSync(binPath)) {
      try {
        await install(binPath)
      } catch (err) {
        // No error on install error.
        // vscode.window.showErrorMessage("Cannot install prisma-fmt: " + err)
      }
    }
    return format(
      binPath,
      options.tabSize,
      document.getText(),
    ).then(formatted => [
      TextEdit.replace(fullDocumentRange(document), formatted),
    ])
  }

  /*async handleDefinitionRequest(
    params: TextDocumentPositionParams,
    _token?: CancellationToken,
  ): Promise<Location> {
    if (!params || !params.textDocument || !params.position) {
      throw new Error('`textDocument` and `position` arguments are required.')
    }
    const textDocument = params.textDocument
    const position = params.position

    // TODO parse schema to AST -> use prisma-enginges/tree/master/libs/datamodel/core/lib.rs
    // TODO <see https://github.com/prisma/prisma-engines/blob/master/libs/datamodel/core/src/lib.rs >

    // TODO find Type
    // TODO  if not a user built type, do nothing -> resolve()
    return {
      uri: textDocument.uri,
      range: Range.create({ line: 2, character: 5 }, { line: 2, character: 6 }),
    }
  }*/

  /*async handleHoverRequest(documents: TextDocuments<TextDocument>, params: TextDocumentPositionParams): Promise<Hover> {
    const textDocument = params.textDocument
    const position = params.position

    const document = documents.get(textDocument.uri);
    const documentText = document?.getText();


    if(!document) {
      return { contents: ''};
    }

    // parse schem file to datamodel meta format (DMMF)
    const dmmf = await getDMMF({ datamodel: documentText })

    let models = dmmf.datamodel.models;
    let modelNames = models.filter(m => m.name);

    const str = JSON.stringify(modelNames);
    
    return {
      contents: str,
    }
  } */
}
