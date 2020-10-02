import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDocumentFormatting } from '../MessageHandler'
import { getBinPath, binaryIsNeeded } from '../util'
import install from '../install'
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
    binPathPrismaFmt,
  )

  // TODO apply edits and compare with fixtures/correct.prisma

  assert.ok(formatResult.length !== 0)
}

// Cache prisma-fmt binary path
let binPathPrismaFmt = ''

suite('Format', () => {
  suiteSetup(async () => {
    // install prisma-fmt binary
    if (binPathPrismaFmt === '') {
      binPathPrismaFmt = await getBinPath()
    }
    if (await binaryIsNeeded(binPathPrismaFmt)) await install(binPathPrismaFmt)
  })

  const fixturePath = './formatting/autoFormat.prisma'

  test('Format should do something', async () => {
    await assertFormat(fixturePath)
  })
})
