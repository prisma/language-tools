import * as fs from 'fs'
import { TextDocument } from 'vscode-languageserver-textdocument'
import path from 'path'

export function getTextDocument(testFilePath: string): TextDocument {
  const content: string = fs.readFileSync(path.join(__dirname, '../../../test/fixtures', testFilePath), 'utf8')
  return TextDocument.create(testFilePath, 'prisma', 1, content)
}
