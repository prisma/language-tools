import { TextDocument } from 'vscode-languageserver-textdocument'

export type Line = [document: SchemaDocument, lineNo: number, text: string]
export class SchemaDocument {
  #untrimmedLines: string[]

  static fromTextDocument(textDocument: TextDocument): SchemaDocument {
    return new SchemaDocument(textDocument.uri, textDocument.getText())
  }

  constructor(
    readonly fileUri: string,
    readonly content: string,
  ) {
    this.#untrimmedLines = content.split(/\r?\n/)
  }

  get lines(): Line[] {
    return this.#untrimmedLines.map((line, lineIndex) => [this, lineIndex, line.trim()] as const)
  }

  getLineContent(lineIndex: number): string {
    return this.#untrimmedLines[lineIndex].trim()
  }

  getUntrimmedLine(lineIndex: number): string {
    return this.#untrimmedLines[lineIndex]
  }
}

type FindRegexpResult = {
  match: RegExpExecArray
  documentUri: string
}

export class PrismaSchema {
  static singleFile(textDocument: TextDocument) {
    return new PrismaSchema([SchemaDocument.fromTextDocument(textDocument)])
  }

  constructor(private readonly documents: SchemaDocument[]) {}

  *iterLines(): Generator<Line, void, void> {
    for (const doc of this.documents) {
      for (const line of doc.lines) {
        yield line
      }
    }
  }

  linesAsArray(): Line[] {
    return Array.from(this.iterLines())
  }

  findDocByUri(fileUri: string): SchemaDocument | undefined {
    return this.documents.find((doc) => doc.fileUri === fileUri)
  }

  findWithRegex(regexp: RegExp): FindRegexpResult | undefined {
    for (const doc of this.documents) {
      regexp.lastIndex = 0
      const match = regexp.exec(doc.content)
      if (match) {
        return { match, documentUri: doc.fileUri }
      }
    }
    return undefined
  }
}
