import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'

import * as fs from 'fs'
import path from 'path'

export const CURSOR_CHARACTER = '|'

const fixturesDir = path.resolve(__dirname, '__fixtures__/single-file')

export function getTextDocument(testFilePath: string): TextDocument {
  const absPath = path.join(fixturesDir, testFilePath)
  const content: string = fs.readFileSync(absPath, 'utf8')

  return TextDocument.create(fixturePathToUri(absPath), 'prisma', 1, content)
}

export function fixturePathToUri(fixturePath: string, rootDir = fixturesDir) {
  const absPath = path.isAbsolute(fixturePath) ? fixturePath : path.join(rootDir, fixturePath)

  // that would normalize testFilePath and resolve all of
  // the . and ..
  const relPath = path.relative(rootDir, absPath)
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
