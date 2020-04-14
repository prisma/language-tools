import {
  TextDocumentPositionParams,
  Hover,
  CancellationToken,
  Location,
  Range,
} from 'vscode-languageserver'
import { getDMMF } from '@prisma/sdk'

export class MessageHandler {
  constructor() {
    // add cache to find types?
  }

  async handleHoverRequest(params: TextDocumentPositionParams): Promise<Hover> {
    return {
      contents: 'Hello World!',
    }
  }

  async handleDefinitionRequest(
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
  }
}
