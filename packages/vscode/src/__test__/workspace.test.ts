import assert from 'node:assert'
import { stat } from 'node:fs/promises'
import vscode from 'vscode'
import { getPrismaCliEntrypoint, getWorkspaceDocUri, getWorkspaceFolder } from './helper'

suite('Multi-root integration workspace', () => {
  test('resolves documents and real Prisma CLI entrypoints per workspace root', async () => {
    const rootA = getWorkspaceFolder('integration-root-a')
    const rootB = getWorkspaceFolder('integration-root-b')

    const documentA = await vscode.workspace.openTextDocument(getWorkspaceDocUri(rootA, 'schema.prisma'))
    const documentB = await vscode.workspace.openTextDocument(getWorkspaceDocUri(rootB, 'schema.prisma'))

    assert.strictEqual(vscode.workspace.getWorkspaceFolder(documentA.uri), rootA)
    assert.strictEqual(vscode.workspace.getWorkspaceFolder(documentB.uri), rootB)
    assert.notStrictEqual(rootA.uri.toString(), rootB.uri.toString())

    for (const workspaceFolder of [rootA, rootB]) {
      const entrypoint = getPrismaCliEntrypoint(workspaceFolder)
      assert.strictEqual(
        (await stat(entrypoint.fsPath)).isFile(),
        true,
        `Missing Prisma CLI entrypoint: ${entrypoint.fsPath}`,
      )
    }
  })
})
