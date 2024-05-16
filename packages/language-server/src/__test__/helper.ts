import * as fs from 'fs'
import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import { loadSchemaFiles } from '@prisma/schema-files-loader'
import path from 'path'
import { URI } from 'vscode-uri'
import { PrismaSchema, SchemaDocument } from '../lib/Schema'

export const CURSOR_CHARACTER = '|'

const fixturesDir = path.resolve(__dirname, '../../test/fixtures')
const multifileFixturesDir = path.join(fixturesDir, 'multifile')

export function getTextDocument(testFilePath: string): TextDocument {
  const absPath = path.join(fixturesDir, testFilePath)
  const content: string = fs.readFileSync(absPath, 'utf8')

  return TextDocument.create(fixturePathToUri(absPath), 'prisma', 1, content)
}

export async function getMultifileSchema(folderPath: string): Promise<PrismaSchema> {
  const files = await loadSchemaFiles(path.join(multifileFixturesDir, folderPath))
  const schemaDocs = files.map(([filePath, content]) => {
    const uri = fixturePathToUri(filePath)
    const doc = TextDocument.create(uri, 'prisma', 1, content.replace(/\n/g, '\r\n'))
    return new SchemaDocument(doc)
  })

  return new PrismaSchema(schemaDocs)
}

export function fixturePathToUri(fixturePath: string) {
  const absPath = path.isAbsolute(fixturePath) ? fixturePath : path.join(fixturesDir, fixturePath)

  // that would normalize testFilePath and resolve all of
  // the . and ..
  const relPath = path.relative(fixturesDir, absPath)
  // this will normalize slashes on win/linux
  return URI.file(`/${relPath}`).toString()
}

export const findCursorPosition = (input: string): Position => {
  const lines = input.split('\n')

  let foundCursorCharacter = -1
  const foundLinePosition = lines.findIndex((line) => {
    const cursorPosition = line.indexOf(CURSOR_CHARACTER)
    if (cursorPosition !== -1) {
      foundCursorCharacter = cursorPosition
      return true
    }
  })

  if (foundLinePosition >= 0 && foundCursorCharacter >= 0) {
    return { line: foundLinePosition, character: foundCursorCharacter }
  }

  throw new Error(
    'Each test must include the `|` pipe character to signal where the cursor should be when executing the test.',
  )
}
