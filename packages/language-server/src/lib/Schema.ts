import { TextDocument } from 'vscode-languageserver-textdocument'

export type Line = {
  readonly document: SchemaDocument
  readonly lineIndex: number
  readonly text: string
  readonly untrimmedText: string
}
export class SchemaDocument {
  readonly lines: Line[]

  static fromTextDocument(textDocument: TextDocument): SchemaDocument {
    return new SchemaDocument(textDocument.uri, textDocument.getText())
  }

  constructor(
    readonly uri: string,
    readonly content: string,
  ) {
    this.lines = content.split(/\r?\n/).map((untrimmedText, lineIndex) => ({
      document: this,
      lineIndex,
      untrimmedText,
      text: untrimmedText.trim(),
    }))
  }

  getLineContent(lineIndex: number): string {
    return this.lines[lineIndex].text
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
    return this.documents.find((doc) => doc.uri === fileUri)
  }

  findWithRegex(regexp: RegExp): FindRegexpResult | undefined {
    for (const doc of this.documents) {
      regexp.lastIndex = 0
      const match = regexp.exec(doc.content)
      if (match) {
        return { match, documentUri: doc.uri }
      }
    }
    return undefined
  }
}
