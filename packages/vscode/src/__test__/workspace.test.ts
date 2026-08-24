import assert from 'node:assert'
import { stat } from 'node:fs/promises'
import vscode from 'vscode'
import {
  localPrismaNextClientTestStateCommand,
  type LocalPrismaNextClientTestState,
} from '../plugins/prisma-language-server/localPrismaNextClientRegistry'
import { getPrismaCliEntrypoint, getWorkspaceDocUri, getWorkspaceFolder, sleep } from './helper'

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

  test('lazily starts the real root-local Prisma Next clients', async () => {
    const rootA = getWorkspaceFolder('integration-root-a')
    const rootB = getWorkspaceFolder('integration-root-b')
    const documentA = await vscode.workspace.openTextDocument(getWorkspaceDocUri(rootA, 'schema.prisma'))
    const documentB = await vscode.workspace.openTextDocument(getWorkspaceDocUri(rootB, 'schema.prisma'))
    const extension = vscode.extensions.getExtension('Prisma.prisma')
    assert.ok(extension)
    await extension.activate()

    assert.deepStrictEqual(await getLocalClientState(), { startedWorkspaceFolderUris: [] })

    const edit = new vscode.WorkspaceEdit()
    edit.insert(documentA.uri, new vscode.Position(0, 0), '// use prisma-next\n')
    edit.insert(documentB.uri, new vscode.Position(0, 0), '// use prisma-next\n')
    assert.strictEqual(await vscode.workspace.applyEdit(edit), true)

    const expectedRoots = [rootA.uri.toString(), rootB.uri.toString()].sort()
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await getLocalClientState()
      if (state.startedWorkspaceFolderUris.join() === expectedRoots.join()) {
        assert.deepStrictEqual(state.startedWorkspaceFolderUris, expectedRoots)
        return
      }
      await sleep(100)
    }

    assert.deepStrictEqual((await getLocalClientState()).startedWorkspaceFolderUris, expectedRoots)
  })
})

async function getLocalClientState(): Promise<LocalPrismaNextClientTestState> {
  return vscode.commands.executeCommand<LocalPrismaNextClientTestState>(localPrismaNextClientTestStateCommand)
}
