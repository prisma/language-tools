import {
  IConnection,
  TextDocuments,
  DiagnosticSeverity,
  Diagnostic,
  Definition,
  TextDocumentPositionParams,
  Range,
  TextEdit,
  Position,
  DocumentFormattingParams,
} from "vscode-languageserver";
import { URI } from "vscode-uri";
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as util from './util'
import lint from './lint'
import fs from 'fs'
import install from './install'
import { Schema } from 'prismafile/dist/ast'
import { parse } from 'prismafile'
import { fullDocumentRange } from './provider'
import format from './format'

let ast: Schema

export class PLS {
  public static start(connection: IConnection) {
    return new PLS(connection)
  }

  private documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

  private validationDelayMs = 800;
  private pendingValidationRequests: {
    [uri: string]: ReturnType<typeof setTimeout>;
  } = {};

  constructor(private connection: IConnection) {
    this.connection = connection;
    this.documents.listen(connection);
    connection.listen();

    this.documents.onDidChangeContent(change =>
      this.queueValidation(change.document)
    );

    this.documents.onDidOpen(change =>
      this.queueValidation(change.document)
    );

    connection.onInitialize(async () => {

      connection.onDocumentFormatting(this.onDocumentFormatting);
      connection.onDefinition(this.onDefinition);
      this.documents.all().forEach(doc => this.queueValidation(doc));

      const binPathPrismaFmt = await util.getBinPath()
      if (!fs.existsSync(binPathPrismaFmt)) {
        try {
          await install(binPathPrismaFmt)
          connection.console.info(
            'Prisma plugin prisma-fmt installation succeeded.',
          )
        } catch (err) {
          connection.console.error('Cannot install prisma-fmt: ' + err)
        }
      }

      return {
        capabilities: {
          documentFormattingProvider: true,
          definitionProvider: true
        }
      }
    });
  }

  public async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    const { fsPath, scheme } = URI.parse(textDocument.uri);

    if (scheme !== "file") {
      return [];
    }

    const text = textDocument.getText(fullDocumentRange(textDocument))
    const binPath = await util.getBinPath()

    const res = await lint(binPath, text, (errorMessage: string) => {
      this.connection.window.showErrorMessage(errorMessage)
    })

    const diagnostics: Diagnostic[] = []

    for (const error of res) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: textDocument.positionAt(error.start),
          end: textDocument.positionAt(error.end),
        },
        message: error.text,
        source: '',
      }
      diagnostics.push(diagnostic)
    }

    if (diagnostics.length === 0) {
      ast = parse(text)
    }
    return diagnostics
  }

  public onDocumentFormatting = async ({
    textDocument,
    options
  }: DocumentFormattingParams): Promise<TextEdit[]> => {
    const document = this.documents.get(textDocument.uri)
    if (!document) {
      return []
    }
    const binPath = await util.getBinPath()
    return format(
      binPath,
      options.tabSize,
      document.getText(),
      (errorMessage: string) => {
        this.connection.window.showErrorMessage(errorMessage)
      },
    ).then((formatted) => [
      TextEdit.replace(fullDocumentRange(document), formatted),
    ])
  }


  public onDefinition = (params: TextDocumentPositionParams): Definition => {
    const textDocument = params.textDocument
    const position = params.position
  
    const document = this.documents.get(textDocument.uri)
  
    if (!document) {
      return []
    }
  
    const documentText = document.getText()
  
    const word = this.getWordAtPosition(document, position)
  
    if (word === '') {
      return []
    }
  
    const found = ast.blocks.find((b) => b.type === 'model' && b.name === word)
  
    // selected word is not a model type
    if (!found) {
      return []
    }
  
    const startPosition = {
      line: found.start.line - 1,
      character: found.start.column - 1,
    }
    const endPosition = {
      line: found.end.line,
      character: found.end.column,
    }
  
    return {
      uri: textDocument.uri,
      range: Range.create(startPosition, endPosition),
    }
  }

  private async queueValidation(textDocument: TextDocument): Promise<void> {
    const previousRequest = this.pendingValidationRequests[textDocument.uri];
    if (previousRequest) {
      clearTimeout(previousRequest);
      delete this.pendingValidationRequests[textDocument.uri];
    }

    this.pendingValidationRequests[textDocument.uri] = setTimeout(async () => {
      delete this.pendingValidationRequests[textDocument.uri];
      this.connection.sendDiagnostics({
        uri: textDocument.uri,
        diagnostics: await this.validateTextDocument(textDocument)
      });
    }, this.validationDelayMs);
  }

  private displayMessage(type: "info" | "warning" | "error", msg: string) {
    this.connection.sendNotification(
      `$ / display${type[0].toUpperCase() + type.slice(1)} `,
      msg
    );
  }

  private getCurrentLine(document: TextDocument, line: number): string {
    return document.getText({
      start: { line: line, character: 0 },
      end: { line: line, character: 9999 },
    })
  }

  private getWordAtPosition(document: TextDocument, position: Position): string {
    const currentLine = this.getCurrentLine(document, position.line)
  
    if (currentLine.slice(0, position.character).endsWith('@@')) {
      return '@@'
    }
    // search for the word's beginning and end
    const beginning = currentLine.slice(0, position.character + 1).search(/\S+$/)
    const end = currentLine.slice(position.character).search(/\W/)
    if (end < 0) {
      return ''
    }
    return currentLine.slice(beginning, end + position.character)
  }
}