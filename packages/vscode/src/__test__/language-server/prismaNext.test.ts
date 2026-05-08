import * as vscode from 'vscode'
import * as assert from 'assert'
import { activate, getDocUri, setTestContent } from '../helper'

function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (d: readonly vscode.Diagnostic[]) => boolean,
  timeoutMs = 5000,
): Promise<readonly vscode.Diagnostic[]> {
  return new Promise((resolve, reject) => {
    const initial = vscode.languages.getDiagnostics(uri)
    if (predicate(initial)) {
      resolve(initial)
      return
    }
    const target = uri.toString()
    const sub = vscode.languages.onDidChangeDiagnostics((e) => {
      if (!e.uris.some((u) => u.toString() === target)) return
      const current = vscode.languages.getDiagnostics(uri)
      if (predicate(current)) {
        sub.dispose()
        clearTimeout(timeout)
        resolve(current)
      }
    })
    const timeout = setTimeout(() => {
      sub.dispose()
      reject(new Error(`Diagnostics for ${target} did not match within ${timeoutMs}ms`))
    }, timeoutMs)
  })
}

suite('Prisma-next directive', () => {
  test('Toggling the directive toggles diagnostics', async () => {
    const docUri = getDocUri('linting/prismaNextDirective.prisma')
    await activate(docUri)

    // Remove the directive: the file should now produce diagnostics
    // (empty datasource block triggers a missing-argument error). This
    // also proves the LSP is alive within the test window.
    await setTestContent('datasource db {\n}\n')
    await waitForDiagnostics(docUri, (d) => d.length > 0)

    // Re-add the directive: diagnostics must clear.
    await setTestContent('// use prisma-next\n\ndatasource db {\n}\n')
    const cleared = await waitForDiagnostics(docUri, (d) => d.length === 0)
    assert.deepStrictEqual([...cleared], [], 'expected diagnostics to clear after adding directive')
  })

  test('Sibling file without directive still gets diagnostics', async () => {
    const docUri = getDocUri('linting/missingArgument.prisma')
    await activate(docUri)
    const diagnostics = await waitForDiagnostics(docUri, (d) => d.length > 0)
    assert.ok(diagnostics.length > 0, 'expected diagnostics on regular file with errors')
  })
})
