import * as vscode from 'vscode'
import * as assert from 'assert'
import { activate, getDocUri } from '../helper'

suite('Prisma-next directive', () => {
  test('Suppresses diagnostics on file with `// use prisma-next` directive', async () => {
    const docUri = getDocUri('linting/prismaNextDirective.prisma')
    await activate(docUri)
    const diagnostics = vscode.languages.getDiagnostics(docUri)
    assert.deepStrictEqual(diagnostics, [], 'expected no diagnostics on prisma-next file')
  })

  test('Sibling file without directive still gets diagnostics', async () => {
    const docUri = getDocUri('linting/missingArgument.prisma')
    await activate(docUri)
    const diagnostics = vscode.languages.getDiagnostics(docUri)
    assert.ok(diagnostics.length > 0, 'expected diagnostics on regular file with errors')
  })
})
