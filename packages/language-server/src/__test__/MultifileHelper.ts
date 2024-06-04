import { URI } from 'vscode-uri'
import { PrismaSchema, SchemaDocument } from '../lib/Schema'
import path from 'path'
import { fixturePathToUri } from './helper'
import { Position, TextEdit } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { loadSchemaFiles } from '@prisma/schema-files-loader'

const multifileFixturesDir = path.join(__dirname, '__fixtures__/multi-file')

export async function getMultifileHelper(fixturePath: string) {
  const schema = await getMultifileSchema(fixturePath)
  const helper = new MultfileHelper(`/${fixturePath}`, schema)
  return helper
}

class MultfileHelper {
  constructor(
    private baseDir: string,
    readonly schema: PrismaSchema,
  ) {}

  file(filePath: string) {
    const doc = this.schema.findDocByUri(URI.file(path.join(this.baseDir, filePath)).toString())
    if (!doc) {
      throw new Error(`${filePath} is not found fixture`)
    }

    return new File(doc)
  }

  applyChanges(edits: Record<string, TextEdit[]> | undefined): Record<string, string> {
    if (!edits) {
      return {}
    }
    const results = {} as Record<string, string>
    for (const [uri, fileEdits] of Object.entries(edits)) {
      let doc = this.schema.findDocByUri(uri)?.textDocument
      if (!doc) {
        doc = TextDocument.create(uri, 'prisma', 1, '')
      }
      const updatedDoc = TextDocument.applyEdits(doc, fileEdits)
      results[uri] = updatedDoc
    }
    return results
  }
}

class File {
  constructor(readonly schemaDocument: SchemaDocument) {}

  get textDocument() {
    return this.schemaDocument.textDocument
  }

  get uri() {
    return this.schemaDocument.uri
  }

  lineContaining(match: string) {
    for (const line of this.schemaDocument.lines) {
      if (line.text.includes(match)) {
        return new Line(line.lineIndex, line.untrimmedText)
      }
    }
    throw new Error(`Can not find line with "${match}"`)
  }
}

class Line {
  constructor(
    readonly lineNumber: number,
    readonly text: string,
  ) {}

  characterAfter(substring: string): Position {
    const index = this.text.indexOf(substring)
    if (index === -1) {
      throw new Error(`Can not find ${substring} in ${this.text}`)
    }
    return {
      line: this.lineNumber,
      character: index + substring.length + 1,
    }
  }
}

async function getMultifileSchema(folderPath: string): Promise<PrismaSchema> {
  const files = await loadSchemaFiles(path.join(multifileFixturesDir, folderPath))
  const schemaDocs = files.map(([filePath, content]) => {
    const uri = fixturePathToUri(filePath, multifileFixturesDir)
    const doc = TextDocument.create(uri, 'prisma', 1, content)
    return new SchemaDocument(doc)
  })

  return new PrismaSchema(schemaDocs)
}
