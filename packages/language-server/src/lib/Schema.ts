import {
  loadRelatedSchemaFiles,
  InMemoryFilesResolver,
  realFsResolver,
  CompositeFilesResolver,
  FilesResolver,
  CaseSensitivityOptions,
} from '@prisma/schema-files-loader'
import { loadConfigFromFile, type PrismaConfigInternal } from '@prisma/config'
import { Position } from 'vscode-languageserver'
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

/**
 * Will try to load the prisma config file from the given path, default path or create a default config.
 */
export async function loadConfig(configRoot?: string): Promise<PrismaConfigInternal> {
  const { config, error, resolvedPath } = await loadConfigFromFile({ configRoot })

  if (error) {
    switch (error._tag) {
      case 'ConfigFileNotFound':
        throw new Error(`Config file not found at "${resolvedPath}"`)
      case 'ConfigFileSyntaxError':
        throw new Error(`Failed to parse config file at "${resolvedPath}"`)
      case 'ConfigLoadError':
        throw new Error(
          `Failed to import config file as TypeScript from "${resolvedPath}". Error: ${error.error.message}`,
        )
      case 'UnknownError':
        throw new Error(`Unknown error during config file loading: ${error.error.message}`)
      default:
        throw new Error(`Unhandled error '${JSON.stringify(error)}' in 'loadConfigFromFile'.`)
    }
  }

  return config
}

async function loadSchemaDocumentsFromPath(fsPath: string, allDocuments: TextDocument[]): Promise<SchemaDocument[]> {
  // `loadRelatedSchemaFiles` locates and returns either a single schema files, or a set of related schema files.
  const schemaFiles = await loadRelatedSchemaFiles(fsPath, createFilesResolver(allDocuments))
  const documents = schemaFiles.map(([filePath, content]) => {
    return new SchemaDocument(TextDocument.create(URI.file(filePath).toString(), 'prisma', 1, content))
  })
  return documents
}

type PrismaSchemaInput = { currentDocument: TextDocument; allDocuments: TextDocument[] } | SchemaDocument[]

export class PrismaSchema {
  // TODO: remove, use `PrismaSchema.load` directly
  static singleFile(textDocument: TextDocument) {
    return new PrismaSchema([new SchemaDocument(textDocument)])
  }

  static async load(input: PrismaSchemaInput, configRoot?: string): Promise<PrismaSchema> {
    let config: PrismaConfigInternal | undefined
    try {
      config = await loadConfig(configRoot)
    } catch (error) {
      console.debug('Failed to load Prisma config file', error)
      console.log('Continuing without Prisma config file')
    }

    let schemaDocs: SchemaDocument[]
    if (Array.isArray(input)) {
      schemaDocs = input
    } else {
      const fsPath = config?.schema ?? URI.parse(input.currentDocument.uri).fsPath
      schemaDocs = await loadSchemaDocumentsFromPath(fsPath, input.allDocuments)
    }
    return new PrismaSchema(schemaDocs, config)
  }

  constructor(
    readonly documents: SchemaDocument[],
    readonly config?: PrismaConfigInternal,
  ) {}

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

function createFilesResolver(allDocuments: TextDocument[]): FilesResolver {
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

function createInMemoryResolver(allDocuments: TextDocument[], options: CaseSensitivityOptions): InMemoryFilesResolver {
  const resolver = new InMemoryFilesResolver(options)
  for (const doc of allDocuments) {
    const filePath = URI.parse(doc.uri).fsPath
    const content = doc.getText()
    resolver.addFile(filePath, content)
  }

  return resolver
}
