import { TextDocument } from 'vscode-languageserver-textdocument'
import { handleDocumentFormatting } from '../MessageHandler'
import { getBinPath, binaryIsNeeded, getDownloadURL } from '../prisma-fmt/util'
import install from '../prisma-fmt/install'
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
    if (binaryIsNeeded(binPathPrismaFmt))
      await install(await getDownloadURL(), binPathPrismaFmt)
  })

  const fixturePath = './formatting/autoFormat.prisma'

  test('Format should do something', async () => {
    await assertFormat(fixturePath)
  })
})
