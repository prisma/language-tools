import * as fs from 'fs'
import { Position, TextDocument } from 'vscode-languageserver-textdocument'
import path from 'path'

export const CURSOR_CHARACTER = '|'

export function getTextDocument(testFilePath: string): TextDocument {
  const content: string = fs.readFileSync(path.join(__dirname, '../../../test/fixtures', testFilePath), 'utf8')
  return TextDocument.create(testFilePath, 'prisma', 1, content)
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
