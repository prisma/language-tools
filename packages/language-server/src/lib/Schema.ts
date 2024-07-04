import {
  loadRelatedSchemaFiles,
  InMemoryFilesResolver,
  realFsResolver,
  CompositeFilesResolver,
  FilesResolver,
  CaseSensitivityOptions,
} from '@prisma/schema-files-loader'
import { Position, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { getCurrentLine } from './ast'

export type Line = {
  readonly document: SchemaDocument
  readonly lineIndex: number
  readonly text: string
  readonly untrimmedText: string
}
export class SchemaDocument {
  readonly lines: Line[] = []

  constructor(readonly textDocument: TextDocument) {
    for (let i = 0; i < textDocument.lineCount; i++) {
      const line = getCurrentLine(textDocument, i)
      this.lines.push({
        document: this,
        lineIndex: i,
        untrimmedText: line,
        text: line.trim(),
      })
    }
  }

  get uri(): string {
    return this.textDocument.uri
  }

  get content(): string {
    return this.textDocument.getText()
  }

  positionAt(offset: number): Position {
    return this.textDocument.positionAt(offset)
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
    return new PrismaSchema([new SchemaDocument(textDocument)])
  }

  static async load(currentDocument: TextDocument, allDocuments: TextDocuments<TextDocument>): Promise<PrismaSchema> {
    const schemaFiles = await loadRelatedSchemaFiles(
      URI.parse(currentDocument.uri).fsPath,
      createFilesResolver(allDocuments),
    )
    const documents = schemaFiles.map(([filePath, content]) => {
      return new SchemaDocument(TextDocument.create(URI.file(filePath).toString(), 'prisma', 1, content))
    })
    return new PrismaSchema(documents)
  }

  constructor(readonly documents: SchemaDocument[]) {}

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

  /**
   *
   * @returns array of (uri, content) tuples. Expected input for prisma-schema-wasm
   */
  toTuples(): Array<[string, string]> {
    return this.documents.map((doc) => [doc.uri, doc.content])
  }

  toJSON() {
    return this.toTuples()
  }
}

function createFilesResolver(allDocuments: TextDocuments<TextDocument>): FilesResolver {
  const options = {
    // Technically, macos and Windows can use case-sensitive file systems
    // too, however, VSCode does not support this at the moment, so there is
    // no meaningful way for us to support them in extension
    // See:
    // - https://github.com/microsoft/vscode/issues/123660
    // - https://github.com/microsoft/vscode/issues/94307
    // - https://github.com/microsoft/vscode/blob/c06c555b481aaac4afd51d6fc7691d7658949651/src/vs/platform/files/node/diskFileSystemProvider.ts#L81
    caseSensitive: process.platform === 'linux',
  }
  return new CompositeFilesResolver(createInMemoryResolver(allDocuments, options), realFsResolver, options)
}

function createInMemoryResolver(
  allDocuments: TextDocuments<TextDocument>,
  options: CaseSensitivityOptions,
): InMemoryFilesResolver {
  const resolver = new InMemoryFilesResolver(options)
  for (const doc of allDocuments.all()) {
    const filePath = URI.parse(doc.uri).fsPath
    const content = doc.getText()
    resolver.addFile(filePath, content)
  }

  return resolver
}
