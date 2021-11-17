import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDocumentFormatting } from '../MessageHandler'
import { TextEdit, DocumentFormattingParams } from 'vscode-languageserver'
import * as assert from 'assert'
import { getTextDocument } from './helper'

async function assertFormat(fixturePath: string): Promise<void> {
  const document: TextDocument = getTextDocument(fixturePath)
  const params: DocumentFormattingParams = {
    textDocument: document,
    options: {
      tabSize: 2,
      insertSpaces: true,
    },
  }

  const formatResult: TextEdit[] = await handleDocumentFormatting(
    params,
    document,
  )

  assert.ok(formatResult.length !== 0)
}

suite('Format', () => {
  suiteSetup(async () => {})

  const fixturePath = './formatting/autoFormat.prisma'

  test('Format should do something', async () => {
    await assertFormat(fixturePath)
  })
})
