import {
  TextDocumentPositionParams,
  CancellationToken,
  TextDocuments,
  DidChangeTextDocumentParams
} from 'vscode-languageserver'
//import { getDMMF } from '@prisma/sdk'
import * as fs from 'fs'
import * as path from 'path'
import { TextDocument } from 'vscode-languageserver-textdocument'

export class MessageHandler {
  constructor(documents: TextDocuments<TextDocument>) {
    
  }

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


  async handleHoverRequest(params:TextDocumentPositionParams) {
    return null;
  }

  async handleDefinitionRequest(
    params: TextDocumentPositionParams,
    _token?: CancellationToken,
  ) {
    return null;
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
}
